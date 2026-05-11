# After Effects Auto Translator

Free ScriptUI panel for After Effects that automatically translates selected text layers into multiple languages using the [MyMemory](https://mymemory.translated.net) API. No registration required.

## Features

- Translates into 8 languages simultaneously: ES, PT, IT, DE, FR, PL, TR, UA
- Each translation is added as a separate disabled layer, color-coded by language
- Handles long texts automatically by splitting into chunks (500 byte API limit)
- Detects existing translations — skip or overwrite with one click
- Email field for 10× higher daily limit (50k vs 5k chars/day)
- Progress indicator: `⏳ Layer 2/5 | ES 3/8`
- Saves email locally via AE settings — set once, works forever

## Installation

1. Download `translateMyMemory.jsx`
2. Copy to `Scripts/ScriptUI Panels/` folder:
   - **macOS:** `/Applications/Adobe After Effects [version]/Scripts/ScriptUI Panels/`
   - **Windows:** `C:\Program Files\Adobe\Adobe After Effects [version]\Support Files\Scripts\ScriptUI Panels\`
3. Restart After Effects
4. Open via **Window → translateMyMemory**

## Usage

1. Select one or more text layers in your composition
2. Check the languages you want
3. Click **▶ Перекласти**

Translated layers are placed directly above the source layer, disabled by default, named `[ES] Your text...`

## API Limits

| Mode                    | Limit            |
| ----------------------- | ---------------- |
| Anonymous (no email)    | 5,000 chars/day  |
| With email (`de` param) | 50,000 chars/day |

Enter your email in the **API Email** panel on first launch. No account needed — MyMemory uses it only as a usage identifier.

## Requirements

- macOS (curl is built-in)
- Windows 10 build 17063+ (curl is built-in); older Windows requires [curl](https://curl.se/windows/) installed manually

## Languages

| Code | Language   | Layer color |
| ---- | ---------- | ----------- |
| ES   | Spanish    | Brown       |
| PT   | Portuguese | Green       |
| IT   | Italian    | Aqua        |
| DE   | German     | Yellow      |
| FR   | French     | Blue        |
| PL   | Polish     | Pink        |
| TR   | Turkish    | Orange      |
| UA   | Ukrainian  | Lavender    |

## License

MIT
