# Image Chat — frontend integration

One post, one conversation about its picture. The user presses **generate with
AI** on a post, says in their own words how the picture should change, and
Relay makes a new one from the picture they are looking at plus what they
typed. They keep going until they are happy, and then press **Add to post**.

**Nothing reaches the post until they press that button.** Generating writes
nothing — not the picture, not `image_status`, not `media`. The post changes on
Add and on nothing else, which is why the user can iterate freely.

Everything below is under:

```
{{baseUrl}}/workspaces/{{workspaceId}}/image-chats/
```

`baseUrl` is `https://<host>/api/v1`. Every request needs
`Authorization: Token <key>`. A workspace the user does not own answers **404**
(never 403), and so does a chat read through the wrong workspace.

> Nothing in the Post payload changed shape for this feature. There is one new
> read-only field on a Post, `image_origin`, described at the end.

---

## Quick start

Three routes, one payload, one polling rule:

| Step | Request | Success |
| --- | --- | --- |
| Open (button on a post) | `POST image-chats/ {"post": id}` | `201` new chat · `200` existing chat |
| Send a message | `POST image-chats/{id}/messages/ {"prompt": "…"}` | `202` generating · `200` answered, nothing generated |
| Poll | `GET image-chats/{id}/` | repeat every ~2 s **while `status === "running"`** |
| Add a picture to the post | `POST image-chats/{id}/add_to_post/ {"image": imageId}` | `200` |

Also available: `GET image-chats/` (paginated list). There is no delete route.

```ts
type ImageChat = {
  id: string;
  post: string;
  post_image_url: string;          // "" when the post has no picture
  post_media_type: "image" | "video" | "none";
  status: "running" | "ready";     // poll while "running"
  messages: ChatMessage[];         // oldest first — render this as the thread
  images: GeneratedImage[];        // oldest first — for a strip/picker only
  created_at: string;
  updated_at: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "agent";
  text: string;
  image: GeneratedImage | null;    // non-null → render a picture card
  created_at: string;
};

type GeneratedImage = {
  id: string;
  status: "pending" | "ready" | "failed";
  url: string;                     // "" until ready
  prompt: string;                  // "" on a base image
  is_base: boolean;                // the post's own picture, copied in
  kind: "edit" | "new";
  source: string | null;           // id of the picture it was made from
  error: string;                   // filled only when failed
  created_at: string;
};
```

UI checklist:

1. **Open.** Call `POST image-chats/` and render `messages` top to bottom.
2. **Picture cards.** Any agent message with `image` is a picture card:
   * `pending`: spinner;
   * `ready`: the picture (**16:9**) and an **Add to post** button;
   * `failed`: no picture.
3. **Send button.** Disable it while `status === "running"`.
4. **After sending**, replace your state with the returned chat. Keep polling
   `GET image-chats/{id}/` while `status === "running"`.
5. **Updating the thread.** Replace state wholesale on each response; never
   append client-side. A turn's card is updated in place: same message id,
   its image goes from `pending` to `ready`/`failed`.
6. **Add to post.** On success, refresh the post preview from
   `post_image_url` / `post_media_type`.
7. **Error bodies.**
   * Show `detail` from a `409`/`400` as-is.
   * A `{"prompt": [...]}` or `{"image": [...]}` body is a field error.
8. **Copy.** Never write agent copy client-side; every sentence comes from the
   backend.

---

## The shape you get back

Every route below returns **the whole chat**, so the screen re-renders from one
payload and never has to merge two:

```jsonc
{
  "id": "3f1c…",
  "post": "9ab2…",
  "post_image_url": "https://…/post_images/generated_9ab2.jpg", // what is ON the post right now
  "post_media_type": "image",                                   // "image" | "video" | "none"
  "status": "ready",                                            // "running" | "ready" — is a turn being generated?
  "messages": [
    {
      "id": "…",
      "role": "agent",                    // "user" | "agent"
      "text": "Tell me how you want to change this image.",
      "image": { … } | null,              // the picture this line is about
      "created_at": "2026-09-23T05:40:11Z"
    }
  ],
  "images": [
    {
      "id": "…",
      "status": "ready",                  // "pending" | "ready" | "failed"
      "url": "https://…/image_chat/turn_….jpg",
      "prompt": "make the desk blue",     // what the user typed for this turn ("" on a base)
      "is_base": false,                   // true = the post's own picture, copied in
      "kind": "edit",                     // "edit" = changed the last picture | "new" = drawn fresh
      "source": "…" | null,               // the picture this one was made from (null on "new")
      "error": "",                        // filled only on "failed"
      "created_at": "2026-09-23T05:41:02Z"
    }
  ],
  "created_at": "2026-09-23T05:40:11Z",
  "updated_at": "2026-09-23T05:41:02Z"
}
```

`messages` and `images` are both **oldest first** — a transcript is read top to
bottom and the chain of edits runs forwards. The list route
(`GET image-chats/`) is the platform's usual paginated envelope
(`count`/`next`/`previous`/`results`, page size 25).

**Render the transcript, not the image list.** `images` is there for a strip or
a picker; the thread is `messages`, and every agent line that carries an
`image` is a card with an **Add to post** button under it — including the very
first one, which is the picture the user walked in with.

---

## 1. Open the chat

```http
POST image-chats/
{ "post": "9ab2…" }
```

* **201** — a new chat. It contains one agent line (the greeting) and, if the
  post has a picture, one `is_base: true` image: the post's picture, copied in.
* **200** — the chat this post already has, with everything the user did in it
  last time. Pressing the button twice is not two chats.

On a **200**, if the post's picture changed since the chat last looked (the
user uploaded one, an Agent edit regenerated one), a **new** `is_base` image is
appended — that is the picture the next turn will edit.

A post in another workspace, or no `post` at all, is **400**:

```json
{ "post": ["No such post in this workspace."] }
```

A post with no picture opens fine: `images` is `[]` and `post_image_url` is
`""`. The first turn then *draws* rather than edits, using the post's body as
the subject.

---

## 2. Send a turn

```http
POST image-chats/{id}/messages/
{ "prompt": "make the desk blue" }
```

The message is **read before anything is spent on it**, and the status code
tells you which of the two things happened.

### 202 — it was a request about the picture

**202 Accepted**, with the chat. In it you will find the user's line and,
already underneath it, **the agent's answer** — written from their own sentence
("Making the desk blue. One moment.") and carrying the new image with
`status: "pending"`. Render the spinner on that card.

```jsonc
202 Accepted
{
  "messages": [
    …,
    { "id": "fd910d21-…", "role": "user",  "text": "make the desk blue", "image": null },
    { "id": "86f452cc-…", "role": "agent", "text": "Making the desk blue. One moment.",
      "image": { "id": "e80e04a6-…", "status": "pending", "url": "", "prompt": "make the desk blue", … } }
  ]
}
```

Then **poll `GET image-chats/{id}/` while `status` is `"running"`** (a turn is
typically 10–25 seconds). The chat-level `status` is the one thing to watch:
it is `"running"` exactly while a turn is being generated, and it is derived
from the same fact the `409` below is thrown on — so a send button driven by it
cannot be enabled at a moment the backend would refuse. It has two values only;
a *failed* turn leaves the chat `"ready"`, because the chat is usable again
(the failure is on the picture, in `image.status` and `image.error`).

**That agent message is the one that settles — no second message arrives, and
on success its text does not change.** The picture appears *under the sentence
that announced it*:

```jsonc
// same message id, same created_at, after the poll
{ "id": "86f452cc-…", "role": "agent", "text": "Making the desk blue. One moment.",
  "image": { "id": "e80e04a6-…", "status": "ready", "url": "https://…jpg", … } }
```

So the chat's `status` tells you *whether to keep polling* and the nested
`image.status` tells you *what to draw on that card*. Do **not** append a card
on `ready`, and do not expect a "here is your image" line — the turn's own
sentence is the label, which is what makes a ten-edit thread readable instead
of a column of identical generic lines.

**Failure is the one case that rewrites it.** The text becomes "I could not
make that image. Try describing the change again.", `image.status` is
`"failed"`, and `image.error` carries the vendor's reason. A line still saying
"one moment" over a dead turn would be false.

The wording of the waiting line varies with what was asked; when the classifier
call itself fails it is the fixed "Working on your image. One moment." Never
key off its text — the two `status` fields are the state.

### Edit or new — read off the same sentence

The same classifier call also decides **which kind** of image request it is,
and records it on the turn's image as `kind`:

* **`"edit"`** — the last `ready` picture is sent to the model as the picture to
  change; `source` points at it. This is any message with a change word (*add,
  update, modify, remove, change, replace, make, put, move…*) — even "Add a
  woman presenting to her team in a bright office" — a colour/lighting/style
  change, a redo ("try again", "another one", "another version"), and anything
  that refers to the current picture ("same style but a different scene").
* **`"new"`** — **no picture is sent**: a fresh one is drawn from the post's body
  plus the user's sentence, and `source` is `null`. This is an explicit ask for
  a new picture ("create a new image based on my post", "start over", "from
  scratch") or a whole scene described with no change word ("a woman presenting
  to her team in a bright office").

Anything unclear, and any classifier failure, is `"edit"`. A `"new"` picture is
an ordinary turn afterwards — the next edit changes *it*. Nothing else about the
flow differs: same 202, same polling, same card. You may show a small "new
image" badge from `kind`; you do not have to.

### 200 — it was not about the picture

A greeting, a question about the assistant, a request about the post's *words*,
anything unrelated: **200 OK**, with the chat, and:

* the user's line, then an **agent line answering them** — written for what
  they actually asked, so it is different every time;
* **no new image** in `images`, nothing pending, nothing queued;
* the chat is **not locked**, so the next message works immediately — including
  while a real generation is still running.

```jsonc
200 OK
{
  "post_image_url": "…unchanged…",
  "messages": [
    …,
    { "role": "user",  "text": "can you make my post longer?", "image": null },
    { "role": "agent", "text": "I only work on this post's picture — the words are edited elsewhere. Want a different setting, mood, or colour?", "image": null }
  ],
  "images": [ { …the base…, "status": "ready" } ]
}
```

**The client rule is one line: poll while `status` is `"running"`.** A 202
comes back already `"running"` and a 200 comes back `"ready"`, so you can
branch on the payload rather than on the HTTP code if you prefer, and you never
have to scan `images[]` yourself.

Anything ambiguous about the picture is generated — "make it pop", "again,
but better", "more like the first one". Turning down a real request costs the
user far more than one unnecessary picture, so the classifier only stops a turn
when the message is plainly something else.

Refusals:

| Code | Body | When |
| --- | --- | --- |
| 400 | `{"prompt": ["This field may not be blank."]}` | empty or whitespace-only |
| 409 | `{"detail": "This chat is already making an image. Wait for it to finish, then try again."}` | a turn of this chat is still running |
| 409 | `{"detail": "This chat has reached its limit of 50 images. Add one to the post and start a new chat to keep going."}` | 50 images in this chat |

**One generation at a time, per chat** — disable the send button while
`status` is `"running"` rather than relying on the 409. A refused turn leaves
nothing behind: no message, no image. Neither the lock nor the 50-image cap
applies to a message that generates nothing, so a user can always keep
talking.

A failed turn releases the lock, so "try again" is literally the next message.

---

## 3. Add to post

```http
POST image-chats/{id}/add_to_post/
{ "image": "…" }
```

**200**, with the chat — `post_image_url` is now the picture that was added,
`post_media_type` says what will publish, and the transcript ends with "Added
to your post."

* Any `ready` image of this chat can be added, **including `is_base`** — that
  is the undo: adding turn 0 back restores the picture the user walked in with.
* The post keeps its own copy of the bytes, so deleting the chat later never
  touches the post.
* The post's media choice is taken **only if it had none**. A post explicitly
  set to `video` stays on video and `post_media_type` says `"video"` — show the
  user that their picture is on the post but the video is what publishes, and
  offer `PATCH posts/{id}/ {"media": "image"}` if they want to switch.
* An `approved` or `scheduled` post is **not** dropped back to `draft`, exactly
  as `upload_image/` has always behaved.

Refusals:

| Code | Body | When |
| --- | --- | --- |
| 400 | `{"image": ["No finished image with that id in this chat."]}` | unknown id, another chat's image, or one still `pending`/`failed` |
| 400 | `{"detail": "This post is already on LinkedIn — its image cannot be changed."}` | the post is `published` |
| 400 | `{"detail": "That image could not be read. Generate it again and add the new one."}` | the stored bytes are gone |

---

## What is new on a Post

One read-only field: **`image_origin`** — `"ai"`, `"stock"`, `"upload"`,
`"chat"`, or `""` when the post has no picture. It says where the current
picture came from, and it is what decides whether a text rewrite refreshes it:
only `"ai"` is re-derived. A picture added from an Image Chat is `"chat"` and
survives every later rewrite, the same way an upload does.

Nothing else about a Post changed. A post still has exactly one picture.

**Every generated picture is 16:9 (landscape)** — a chat turn, an edit of a
square upload, and a post's own AI image alike. Size the preview for that
ratio; an uploaded picture keeps whatever shape it was uploaded in until a turn
edits it.

---

## Copy that comes from the backend

These arrive as message text; do not re-write them client-side, and do not
invent your own for the same events.

| Event | Text |
| --- | --- |
| chat opened | Tell me how you want to change this image. |
| chat opened on a post with no picture | Tell me what image you want for this post, and I will create it. |
| turn accepted | *written from what they asked — "Making the desk blue. One moment."; "Working on your image. One moment." if that call failed* |
| turn finished | *unchanged — the accepted line stays and the picture appears under it* |
| turn failed | I could not make that image. Try describing the change again. |
| added to the post | Added to your post. |
| message was not about the picture | *written for what they asked — varies every time* |

One turn is always **one** agent card. It is written on send, and only a
failure rewrites its text; a success changes nothing but the picture inside it.
("Here is the updated image." still exists in the backend as a fallback for a
turn that was never announced — you will not see it on a turn sent through this
route.)

A turn is bounded twice — the vendor socket, and a 5-minute limit on the whole
job — and either way it lands as `failed` with the same "I could not make that
image" line. A turn still `pending` after 20 minutes (a worker that died, a
queue nobody consumes) is failed by a background sweep, which settles that same
card too. So a spinner never runs
forever, and the chat becomes usable again on its own.
