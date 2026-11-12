# Korean recast — casting sheet (eleven_v4)

Source of truth for the plan: `tools/recast_plan.py` (cast table + per-line audio-tag direction + priority order);
`tools/recast_apply.py` downloads a finished take, loudness-normalises it exactly like `tools/redub_korean.py`
(`highpass=65, loudnorm I=-19 / -23 whisper, TP -2, LRA 11`, mono 44.1 kHz 128k) and updates `voice/manifest.json`.

Voice design (`creative_design_voice`) refuses descriptions of 17–18-year-old characters, so all
teen roles are cast from the Korean voice library instead.

| speaker | voice_id | voice | why |
|---|---|---|---|
| jihun (지훈, 남 17) | HrAPO433QYkPmU4F4CHw | Jun Ho – Friendly & Drama Actor | young male, natural conversational tone, built for K-drama dialogue with wide emotional range |
| seoyeon (서연, 여 17) | O2KReOFLpoR65nz6C9Se | Aria – Bright & Youthful Korean | youngest-sounding expressive female voice in the library, clear standard accent |
| mina (선배 박민아, 여 18) | 5I7B1di44aCL15NkP0jn | Kanna – Calm & Friendly | slightly older, softer “friend/senior” timbre; carries worried, tired phone messages |
| haneul (윤하늘, 1998 tapes) | 1BZBO072RKJTzZcDjRox | Sora – Warm Korean Storyteller | breathy, gentle K-drama voice for the lost girl’s rehearsal tapes |
| narrator | 8G6jifm9f1BhHXadvwOt | Kang – Calm, Deep Korean Storyteller | 40s deep male made for mystery/audio-drama narration; unifies the two narrator voices used before |
| guard (경비원 박종철, 60대) | UmYoqGlufKxhJ6NCx5Mv | Jang ho 장호 | old, husky male — matches the 60-something guard better than the previous middle-aged voice |
| headTeacher / teacher (교무부장) | 4JJwo477JUAx3HV0T7n7 | Yohan Koo – Confident authority | cold, precise authority for the man who held the key |
| principal / witness_principal (교장) | kiVK4omWhBQ9AzwcaRq7 | Hyeonwoo | refined mid-50s voice, kept; direction changed to [regretful] |
| scienceTeacher / witness_science | l6fNdLYgoqjfTIPUeFc9 | MJ – Calm, Clear, Versatile | thoughtful, expressive without theatrics |
| junho (이준호, now ~28) | Ir7oQcBXWiq4oFGROCfj | taemin | warm 20s male with emotional delivery |
| mother (하늘 어머니) | tbMC7ogaglVnkFQgUOta | Anisia – Calm, natural, warm | middle-aged warm female for grief lines |
| cook, dormMother | 0oqpliV6dVSr9XomngOW | Jini – Warm & Intelligent | middle-aged female |
| mom (주인공 엄마) | 9cino9hfS3ougiPeFvp1 | 수진 – 밝고 친근한 여성 | late-30s natural mother voice |
| reporter, pa, peTeacher, homeroom, nurse, librarian, counselor, friend, friend2, snackLady, paramedic, vicePrincipal, electrician, musicTeacher, artTeacher, janitor, dispatcher, police, classRep | (unchanged) | current library voices | already age/role-appropriate; re-performed with new per-line tags only |

## Status (2026-11-12)

The ElevenLabs workspace hit its quota (150,065 credits; ~14 left) after the first batch.

* Applied (new take in `voice/`): `intro1`, `intro2`, `intro4`, `intro1n`, `intro2n` (narrator, Kang).
* Generated but **not applied** (would mix old and new voices for the same character until the rest is re-dubbed):
  `intro3`, `intro3n` (mina), `intro4n_s` (seoyeon), `intro4n_j` (jihun), `news_s` (seoyeon), `ghThanks` (mother).
* Remaining: 637 lines, ≈48,000 characters ≈ 60,000 credits at the observed ~1.25 credits/char.
  Order: intro → main story (`l_`, `cam`, `bc`, `mw`, `news`, `pr_`, `mc_`, `cue_`, guard talk) → endings →
  calls/phone/radio → tapes/testimonies → notes → incidental (`elv_`).
