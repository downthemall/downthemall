# Translations

Right now we did not standardize on a tool to translate, so feel free to whip our your favorite text edits, JSON editor, special translation tool, what have you.

To make a translation of DownThemAll! in your language, please:

* Get the [`en/messages.json`](https://github.com/downthemall/downthemall/raw/master/_locales/en/messages.json) as a base.
* Translate the `"message"` items in that file only.
  * Do not translate anything other.
  * Do not remove anything.
  * Do not translate `$PLACEHOLDERS$`. Placeholders should appear in your translation with the same spelling and all uppercase.
    They will be relaced at runtime with actual values.
  * Make sure you save the file in an "utf-8" encoding. If you need double quotes, you need to escape the quotes with a backslash, e.g. `"some \"quoted\" text"`
  * You should translate all strings. If you want to skip a string, set it to an empty `""` string. DTA will then use the English string.
* Once you are at a point you want to test things:
  * Go to the DownThemAll! Preferences where you will find a "Load custom translation" button.
  * Select your translated `messages.json`. (it doesn't have to be named exactly like that, but should have a `.json` extension)
  * If everything was OK, you will be asked to reload the extension (this will only reload DTA not the entire browser).
  * See your strings in action once you reloaded DTA (either by answering OK when asked, or disable/enable the extension manually or restart your browser).
* If you're happy with the result and would like to contribute it back, you can either file a full Pull Request, or just file an issue and post a link to e.g. a [gist](https://gist.github.com/) or paste the translation in the issue text.
