# Translations

Right now we did not standardize on a tool/website/community use for translations

## Website-based Translation

Please go to [https://downthemall.github.io/translate/](https://downthemall.github.io/translate/) for a "good enough" tool to translate DownThemAll! for now. It will load the English locale as a base automatically.

Then you can translate (your progress will be saved in the browser). Once done, you can Download the `messages.json` and test it or submit it for inclusion.

You can also import your or other people's existing translations to modify. This will overwrite any progress you made so far, tho.

## Manual Translation

* Get the [`en/messages.json`](https://github.com/downthemall/downthemall/raw/master/_locales/en/messages.json) as a base.
* Translate the `"message"` items in that file only. Whip our your favorite text editor, JSON editor, special translation tool, what have you.
  * Do not translate anything besides the "message" elements. Pay attention to the descriptions.
  * Do not remove anything.
  * Do not translate `$PLACEHOLDERS$`. Placeholders should appear in your translation with the same spelling and all uppercase.
    They will be relaced at runtime with actual values.
* Make sure you save the file in an "utf-8" encoding. If you need double quotes, you need to escape the quotes with a backslash, e.g. `"some \"quoted\" text"`
* You should translate all strings. If you want to skip a string, set it to an empty `""` string. DTA will then use the English string.

## Testing Your Translation

* Go to the DownThemAll! Preferences where you will find a "Load custom translation" button.
* Select your translated `messages.json`. (it doesn't have to be named exactly like that, but should have a `.json` extension)
  * If everything was OK, you will be asked to reload the extension (this will only reload DTA not the entire browser).
* See your strings in action once you reloaded DTA (either by answering OK when asked, or disable/enable the extension manually or restart your browser).

## Submitting Your Translation

If you're happy with the result and would like to contribute it back, you can either file a full Pull Request, or just file an issue and post a link to e.g. a [gist](https://gist.github.com/) or paste the translation in the issue text.
