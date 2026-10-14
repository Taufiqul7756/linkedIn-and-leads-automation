# LinkedIn Agent — Full Project Test Cases

Test plan for the whole app. The Excel copy (`test-cases.xlsx`, same cases and IDs) is the one testers fill in.

**Total:** 150 cases · **Important:** 41 · **Medium:** 70 · **Low:** 39

**Priority:** Important = core flow, a fail blocks release · Medium = main feature works, a secondary path is broken · Low = cosmetic / edge case.

## Contents

- **LOGIN** — Login & Account (8)
- **WS** — Workspace (4)
- **NAV** — Navigation & Layout (4)
- **ACC** — LinkedIn Account Connection (4)
- **KB** — Knowledge Base (13)
- **TONE** — Tone / Style (4)
- **AUD** — Audience & Post Length (5)
- **SET** — Composer Settings (14)
- **AGT** — Agent Chat (Generate Posts) (13)
- **DRAFT** — Draft Cards (in chat) (11)
- **VER** — Post Version History (5)
- **ATT** — Chat Attachments (10)
- **RA** — Review & Approval (8)
- **PM** — Post Management (11)
- **PUB** — Publishing (3)
- **IMG** — Edit Image (Image Chat) (16)
- **STOCK** — Stock Image (Pexels) (6)
- **IKB** — Image Knowledge Base (6)
- **LEADS** — Leads (5)

## LOGIN — Login & Account

| ID | Priority | Test Case | Acceptance Criteria |
|---|---|---|---|
| LOGIN-001 | 🔴 Important | Register a new account | Account is created, 'Account created!' toast shows and user lands inside the app |
| LOGIN-002 | 🟠 Medium | Register with invalid / existing data | Clear error message for each case; no account created |
| LOGIN-003 | 🔴 Important | Login with valid credentials | 'Welcome back!' toast, user lands on the app with their workspace loaded |
| LOGIN-004 | 🔴 Important | Login with wrong password | Error toast from backend; user stays on login page |
| LOGIN-005 | 🔴 Important | Protected pages need login | User is sent to /login; no app page is shown |
| LOGIN-006 | 🟠 Medium | Sign out | Confirm dialog shows first; after confirm user is logged out and sent to /login |
| LOGIN-007 | 🟠 Medium | Expired / invalid session | User is logged out and redirected to /login (no broken page) |
| LOGIN-008 | 🟢 Low | Settings page shows user details | User's details are shown correctly (read-only) |

## WS — Workspace

| ID | Priority | Test Case | Acceptance Criteria |
|---|---|---|---|
| WS-001 | 🔴 Important | Switch workspace | All data (posts, knowledge, settings, chats) changes to the selected workspace |
| WS-002 | 🟠 Medium | Workspace survives reload | Same workspace is still active; ?workspace= stays in the URL |
| WS-003 | 🔴 Important | Data isolation between workspaces | Nothing from Workspace A is visible in Workspace B |
| WS-004 | 🟢 Low | Switch workspace on Edit Image page | 'Post not found in this workspace' screen with 'Go to Agent' and 'Post Management' buttons |

## NAV — Navigation & Layout

| ID | Priority | Test Case | Acceptance Criteria |
|---|---|---|---|
| NAV-001 | 🟠 Medium | Sidebar links open the right pages | Each opens the correct page; active item is highlighted |
| NAV-002 | 🟢 Low | Collapse / expand sidebar | Sidebar collapses to icons with tooltips and expands back |
| NAV-003 | 🟢 Low | Coming-soon items | Shows 'Soon' badge and can't be opened |
| NAV-004 | 🟢 Low | Small screen layout | Pages are usable; no broken overlaps or cut-off buttons |

## ACC — LinkedIn Account Connection

| ID | Priority | Test Case | Acceptance Criteria |
|---|---|---|---|
| ACC-001 | 🔴 Important | Connect LinkedIn account | Returns to the app, 'LinkedIn account connected!' toast, account shown as connected |
| ACC-002 | 🟠 Medium | Cancel / fail LinkedIn connection | 'Failed to connect LinkedIn account.' toast; nothing marked connected |
| ACC-003 | 🟠 Medium | Disconnect LinkedIn account | 'LinkedIn account disconnected.' toast, account removed |
| ACC-004 | 🔴 Important | Account is used for publishing | Post is published to the connected LinkedIn account |

## KB — Knowledge Base

| ID | Priority | Test Case | Acceptance Criteria |
|---|---|---|---|
| KB-001 | 🔴 Important | Add LinkedIn profile | Profile row appears (Processing → Ready); URL input hides while a profile exists |
| KB-002 | 🔴 Important | LinkedIn profile pulls real data | Summary matches the real profile; no made-up or extra data |
| KB-003 | 🟢 Low | Reject non-profile URL | Toast: 'Enter a LinkedIn profile URL (linkedin.com/in/…)' |
| KB-004 | 🟠 Medium | Delete LinkedIn profile | Row removed; profile URL input comes back |
| KB-005 | 🔴 Important | Add website / link with note | Row added with URL as title and 'Note: …' under it; goes Processing → Ready |
| KB-006 | 🟠 Medium | URL validation | Invalid ones: Add disabled + red 'Enter a valid link' after blur; acme.com is accepted |
| KB-007 | 🔴 Important | Upload PDF with note | PDF row added with note; Processing → Ready |
| KB-008 | 🟢 Low | Cancel a staged PDF | PDF is not uploaded; form is cleared |
| KB-009 | 🟠 Medium | Edit / add a note on a source | Note saved and shown; Esc cancels without saving |
| KB-010 | 🟢 Low | Note max 200 characters | Counter shows n/200; can't type past 200 |
| KB-011 | 🟠 Medium | Delete a knowledge source | Row removed; also gone from Composer settings → Knowledge |
| KB-012 | 🟠 Medium | Failed source shows error | Row shows Failed badge; app doesn't break |
| KB-013 | 🟢 Low | Sources are clickable | Opens in a new tab |

## TONE — Tone / Style

| ID | Priority | Test Case | Acceptance Criteria |
|---|---|---|---|
| TONE-001 | 🔴 Important | Add tone / style link | Row added, Processing → Ready, appears in Composer settings → Tone / Style |
| TONE-002 | 🟠 Medium | Add tone / style PDF | Row added and processed |
| TONE-003 | 🟢 Low | Profile URL refused as tone source | Toast: LinkedIn profiles can't be a tone / style source |
| TONE-004 | 🔴 Important | Generated post follows the voice | Post writing style clearly matches the sample |

## AUD — Audience & Post Length

| ID | Priority | Test Case | Acceptance Criteria |
|---|---|---|---|
| AUD-001 | 🟠 Medium | Target audience autosave | 'Saving…' → 'Saved'; value is still there after reload |
| AUD-002 | 🟠 Medium | Post length presets | Pill highlights and saves at once; survives reload |
| AUD-003 | 🟢 Low | Custom post length | Saved; no pill highlighted; clearing it = Let agent decide |
| AUD-004 | 🔴 Important | Audience & length used in posts | Posts target that audience and are about the chosen length |
| AUD-005 | 🟠 Medium | Toggles off = ignored | Audience / length values are not applied |

## SET — Composer Settings

| ID | Priority | Test Case | Acceptance Criteria |
|---|---|---|---|
| SET-001 | 🔴 Important | Post count | Exactly that many drafts (1–20) |
| SET-002 | 🟠 Medium | Use hashtags on / off | On: hashtags on last line (not repeated); Off: no hashtags |
| SET-003 | 🟠 Medium | Use emoji on / off | Emoji only when on (or when the prompt / tone asks for it) |
| SET-004 | 🟠 Medium | Use AI image off | Drafts have no image and no image placeholder |
| SET-005 | 🟠 Medium | Skip headline round | No headline / concepts step; posts are written directly |
| SET-006 | 🟠 Medium | Skip clarifying questions | No question round (except attachment questions) |
| SET-007 | 🔴 Important | Knowledge switches | Only the switched-on source is used; summary shows 'n of total on' |
| SET-008 | 🟠 Medium | All knowledge off | Posts written from the prompt only, no knowledge |
| SET-009 | 🟠 Medium | Tone / style switches blend | 2 on = blended voice; all off = default voice |
| SET-010 | 🟢 Low | Empty knowledge list | 'Nothing added yet — Add in Knowledge base' opens the modal |
| SET-011 | 🟢 Low | Settings panel not cut off | Panel stays fully visible and scrolls; list scrolls after 5 rows |
| SET-012 | 🟠 Medium | Settings saved after reload | All toggles keep their values |
| SET-013 | 🟠 Medium | Writer AI model picker | Selected model is checked and stays after reload; used for next generation |
| SET-014 | 🟢 Low | Settings locked while running | Model picker disabled while running / waiting for answers |

## AGT — Agent Chat (Generate Posts)

| ID | Priority | Test Case | Acceptance Criteria |
|---|---|---|---|
| AGT-001 | 🔴 Important | Generate posts from a prompt | Draft cards appear in the chat matching the prompt and settings |
| AGT-002 | 🔴 Important | Clarifying questions form | Defaults pre-selected; answers accepted; flow continues |
| AGT-003 | 🟠 Medium | Skip a question / skip questioning | Agent continues without that answer |
| AGT-004 | 🔴 Important | Headlines / concepts round | One post per line in the approved list, first line matches |
| AGT-005 | 🟠 Medium | Suggest more concepts | Card stays, shows 'Suggesting…' + skeleton rows, then new lines fade in |
| AGT-006 | 🟠 Medium | Cancel a running generation | Run stops; chat can be used again |
| AGT-007 | 🟠 Medium | Send blocked while running | Send disabled until the run finishes |
| AGT-008 | 🟠 Medium | New chat | Empty chat; previous chat is in History |
| AGT-009 | 🟠 Medium | History: open old conversation | Whole conversation with its drafts loads |
| AGT-010 | 🟠 Medium | Reload keeps the conversation | Same conversation re-opens; running state continues |
| AGT-011 | 🟠 Medium | Clickable link in post body | With link: link is in the body and clickable; without: no link |
| AGT-012 | 🟢 Low | Very long prompt | Clear error, nothing breaks |
| AGT-013 | 🟢 Low | Agent failure | Failure message in chat; user can send again |

## DRAFT — Draft Cards (in chat)

| ID | Priority | Test Case | Acceptance Criteria |
|---|---|---|---|
| DRAFT-001 | 🔴 Important | Approve a draft | Status changes to Approved; post appears in Post Management |
| DRAFT-002 | 🟠 Medium | Approve with past publish time | Error toast + 'Edit Suggested Publish Time' modal opens pre-filled |
| DRAFT-003 | 🟠 Medium | Edit suggested publish time | Time updated on the card |
| DRAFT-004 | 🟠 Medium | Past time is rejected inline | Red error under the input, modal stays open, no toast |
| DRAFT-005 | 🔴 Important | Edit text of a draft | Card shows new text; a 'You edited post N…' card appears in chat |
| DRAFT-006 | 🟠 Medium | Edit image from a draft | Edit modal / image editor opens for that post |
| DRAFT-007 | 🔴 Important | Edit a post by prompt | Only that post changes as asked, others untouched |
| DRAFT-008 | 🟠 Medium | Edit by prompt following a link / tone | Post updated following that link / tone |
| DRAFT-009 | 🔴 Important | Select a card to target the prompt | 'Prompting for: <headline>' pill shows; only that post is edited; selection clears after send |
| DRAFT-010 | 🟠 Medium | Generate more drafts | Skeleton cards append, then new drafts appear in the same set |
| DRAFT-011 | 🟢 Low | Card actions on published post | No checkbox / edit for published posts |

## VER — Post Version History

| ID | Priority | Test Case | Acceptance Criteria |
|---|---|---|---|
| VER-001 | 🟠 Medium | Old card shows old version | Earlier card shows 'Old version · vN', no approve/edit |
| VER-002 | 🟠 Medium | Version history modal | All versions listed with source, date, prompt; Current tagged; Show full post works |
| VER-003 | 🔴 Important | Use this version (restore) | Old content comes back as a new version number; card becomes latest |
| VER-004 | 🟠 Medium | Restore an approved post | Post goes back to Draft |
| VER-005 | 🟢 Low | Read more on old version | Modal shows full old post with 'Use this version' |

## ATT — Chat Attachments

| ID | Priority | Test Case | Acceptance Criteria |
|---|---|---|---|
| ATT-001 | 🔴 Important | Attach a PDF | 'Uploading…' chip → '#1 file.pdf' chip (blue when ready) |
| ATT-002 | 🔴 Important | Attach a URL | '#n url' chip appears and turns ready |
| ATT-003 | 🟠 Medium | Max 5 attachments | 'Maximum 5 attachments reached.'; actions disabled |
| ATT-004 | 🟢 Low | Numbers never reused | Chips: #1, #3, #4 |
| ATT-005 | 🟠 Medium | Remove attachment | Chip removed |
| ATT-006 | 🔴 Important | Attachment used only when mentioned | Step 2 ignores it; step 3 uses it |
| ATT-007 | 🟠 Medium | Attachment as tone | Post follows the attachment's writing style |
| ATT-008 | 🟠 Medium | Unclear attachment question | Agent asks which one / how to use; Next disabled until picked |
| ATT-009 | 🟢 Low | Failed attachment | Red 'Failed' chip with error on hover |
| ATT-010 | 🟢 Low | Send blocked while uploading | Can't send until upload is ready |

## RA — Review & Approval

| ID | Priority | Test Case | Acceptance Criteria |
|---|---|---|---|
| RA-001 | 🔴 Important | Drafts listed for review | All drafts show as cards with pagination |
| RA-002 | 🟢 Low | Filter by conversation | Only drafts from that conversation show |
| RA-003 | 🟢 Low | Page size and pages | Correct number of cards per page |
| RA-004 | 🔴 Important | Approve from review | Post moves to Approved in the table |
| RA-005 | 🟠 Medium | Edit text from review | Post updated |
| RA-006 | 🟠 Medium | Edit image from review | Opens Edit Image page for that post; back returns to review |
| RA-007 | 🔴 Important | Edit with agent | Agent page opens with the post; the change is applied |
| RA-008 | 🟠 Medium | Edit with agent twice = same chat | Opens the same conversation; no duplicate chat created |

## PM — Post Management

| ID | Priority | Test Case | Acceptance Criteria |
|---|---|---|---|
| PM-001 | 🟠 Medium | Stats cards | Drafts / approved / scheduled / published / failed counts are correct |
| PM-002 | 🟠 Medium | Filter by status | Only that status shows |
| PM-003 | 🔴 Important | Schedule an approved post | 'Post scheduled!' toast; status = Scheduled with that time |
| PM-004 | 🔴 Important | Reschedule a scheduled post | 'Post rescheduled!'; new time shown |
| PM-005 | 🟠 Medium | Re-schedule from the agent chat | Schedule updates correctly |
| PM-006 | 🟠 Medium | Schedule in the past | Rejected with clear error |
| PM-007 | 🟠 Medium | Move back to draft | Post is Draft again and in Review |
| PM-008 | 🟠 Medium | Delete a post | 'Post deleted.'; removed everywhere |
| PM-009 | 🟢 Low | Bulk delete | 'N posts deleted.' |
| PM-010 | 🟢 Low | Calendar view drag to reschedule | 'Post moved.' and date updated |
| PM-011 | 🟢 Low | Open published post on LinkedIn | Opens the real post on LinkedIn |

## PUB — Publishing

| ID | Priority | Test Case | Acceptance Criteria |
|---|---|---|---|
| PUB-001 | 🔴 Important | Scheduled post publishes on time | Post is live on LinkedIn at that time; status = Published |
| PUB-002 | 🔴 Important | Published post content is correct | Text, line breaks, emoji, hashtags, link and image match |
| PUB-003 | 🟠 Medium | Publish fails gracefully | Status = Failed with a reason; no silent loss |

## IMG — Edit Image (Image Chat)

| ID | Priority | Test Case | Acceptance Criteria |
|---|---|---|---|
| IMG-001 | 🔴 Important | Open Edit Image page | Chat, post preview and media tabs load; existing image shown |
| IMG-002 | 🔴 Important | Generate an image from prompt | Your message shows at once; thinking steps; image appears |
| IMG-003 | 🔴 Important | Add image to post | Preview + media update; button shows Added |
| IMG-004 | 🟠 Medium | Added state survives reload | Preview, media and Added button still correct |
| IMG-005 | 🟠 Medium | Delete post image | Image removed from post |
| IMG-006 | 🔴 Important | Edit an existing image by prompt | New image follows the request |
| IMG-007 | 🟠 Medium | 'AI generated image' suggestion | A new AI image is generated |
| IMG-008 | 🟠 Medium | Use post body on / off | On: image relates to the post; Off: follows prompt only |
| IMG-009 | 🟠 Medium | Change AI model | Selection saved; next image uses it |
| IMG-010 | 🟠 Medium | Change image style | Next image uses that style |
| IMG-011 | 🟠 Medium | Change media size / ratio | Next image is in that ratio |
| IMG-012 | 🟢 Low | Image sizes look right | No cropping in chat, preview, lightbox |
| IMG-013 | 🟢 Low | Download / open large image | Large view opens; file downloads |
| IMG-014 | 🟢 Low | Chat scroll | Opens at bottom; scroll button jumps to newest |
| IMG-015 | 🟢 Low | Published post is read-only | No composer / stock button |
| IMG-016 | 🟢 Low | Disabled toolbar buttons | Disabled with 'Soon' tooltip |

## STOCK — Stock Image (Pexels)

| ID | Priority | Test Case | Acceptance Criteria |
|---|---|---|---|
| STOCK-001 | 🟠 Medium | Recommended stock photos | Photos recommended for the post load (skeleton first) |
| STOCK-002 | 🟠 Medium | Search stock photos | Results update as you type; more load on scroll |
| STOCK-003 | 🔴 Important | Add stock photo to post | Modal closes; post image updated; 'Added a stock photo' card in chat |
| STOCK-004 | 🟢 Low | Large preview | Large view with photographer + Back / Add to post |
| STOCK-005 | 🟢 Low | Modal closes only with ✕ | Modal stays open |
| STOCK-006 | 🟢 Low | No results / error | 'No photos found for …'; errors show Retry |

## IKB — Image Knowledge Base

| ID | Priority | Test Case | Acceptance Criteria |
|---|---|---|---|
| IKB-001 | 🟠 Medium | Add image knowledge link / PDF | Source added, Pending → Ready, switched On |
| IKB-002 | 🟠 Medium | Write it yourself (text) | Text source added (max 8,000 chars) |
| IKB-003 | 🟢 Low | Edit a text source | Text updated, same position and switch |
| IKB-004 | 🟢 Low | Delete image knowledge source | Removed from list and settings |
| IKB-005 | 🟠 Medium | Image knowledge switches | Each switch independent; saved |
| IKB-006 | 🔴 Important | Images follow image knowledge | Image follows the brand guide |

## LEADS — Leads

| ID | Priority | Test Case | Acceptance Criteria |
|---|---|---|---|
| LEADS-001 | 🟠 Medium | Open Leads page | A working page opens (no 404) |
| LEADS-002 | 🟢 Low | Generate leads - required fields | 'required' shown on empty fields |
| LEADS-003 | 🟠 Medium | Generate leads | Progress modal, then leads list loads |
| LEADS-004 | 🟢 Low | Export leads to CSV | CSV downloads with the leads |
| LEADS-005 | 🟢 Low | Leads Outreach page | 'Coming soon' message shows |
