# Spilio — After Effects CEP extension

Source of the Spilio panel (Motion Kit, Tags, Subs, Org) for After Effects 25+.

## Credentials are NOT in this repository

The shipped build carries API keys inside the code. They are replaced here with placeholders and must be filled in before building:

- `panels/subs/config.js` — `ELEVENLABS_API_KEY`, `OPENAI_API_KEY`
- `client/body-picker.js` — `DEFAULTS.airToken` (read-only Airtable PAT; can also be set via `localStorage["fitme.body.airToken"]`)
- `client/body-auth.js` — `CLIENT_SECRET` of the Google OAuth desktop client

## Build

`host/index.jsx` is generated — edit `host/modules/*.jsx`, then run:

```bash
python3 tools/gen-host.py 1.3.2
```

Package the folder with ZXPSignCmd (the `META-INF/` signature of the original build is not kept here).
