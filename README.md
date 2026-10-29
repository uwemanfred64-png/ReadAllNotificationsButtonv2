# ReadAllNotificationsButtonv2

![ReadAllNotificationsButtonv2](images/banner.png)

A BetterDiscord plugin that adds a **read all** button to the server list and a button to the mentions popout that clears every recent mention. It works on its own, no library plugin needed.

Based on the idea of [ReadAllNotificationsButton](https://betterdiscord.app/plugins/ReadAllNotificationsButton) by DevilBro, written from scratch.

## Features

**Server list button**

![Click actions of the read all button](images/actions.png)

- Left click marks your selection as read: unread servers, muted servers and direct messages with mentions (choose in the settings)
- Shift+click marks everything as read, including muted servers and all unread direct messages
- Middle click marks only the server you are currently in as read
- Uses Discord's own "Mark as Read" for servers, so channels, threads, forum posts, events and onboarding are covered
- Counter on the button: your mentions, or unread servers and direct messages, or off
- Tooltip with the unread servers by name and their mention counts

**Right click menu on the button**

![Right click menu of the read all button](images/menu.png)

- Unread Servers, Pinged Servers, Muted Servers, All Servers, Direct Messages
- Current Server, All Servers except the current one
- Folders: every server folder that has something unread
- All unread Direct Messages

**Right click menu on a server, channel, category or thread**
- "Exclude from read all" puts it on the black list or takes it off again. An excluded category also covers its channels and their threads.

**Mentions popout**
- Close (All) button that removes every recent mention, one per second so Discord does not rate limit you

**Settings**
- Language: automatic (follows Discord) or one of the 30 languages below
- Only mark messages as read that are older than 1, 6 or 24 hours; newer messages and channels with mentions stay unread
- Keep channels with mentions unread
- Confirmation before marking or clearing
- Server black list and the list of excluded channels
- Keybind for the left click action (a keybind without Ctrl or Alt is ignored while you type)
- Mark your selection as read every 5, 15, 30 or 60 minutes
- Mark muted servers as read automatically, 5 seconds after a new message
- Mark everything as read when Discord starts
- Custom button text, hide the button while nothing is unread, turn the result messages off

**Languages**

Bulgarian, Chinese (Simplified and Traditional), Croatian, Czech, Danish, Dutch, English, Finnish, French, German, Greek, Hindi, Hungarian, Indonesian, Italian, Japanese, Korean, Lithuanian, Norwegian, Polish, Portuguese (Brazil), Romanian, Russian, Spanish, Swedish, Thai, Turkish, Ukrainian, Vietnamese.

## Installation

1. Download [ReadAllNotificationsButtonv2.plugin.js](https://github.com/uwemanfred64-png/ReadAllNotificationsButtonv2/releases/latest/download/ReadAllNotificationsButtonv2.plugin.js) from the latest release
2. Put it into your BetterDiscord plugins folder (User Settings → Plugins → Open Plugins Folder)
3. Enable it in User Settings → Plugins

If you use the original ReadAllNotificationsButton, disable it first, otherwise you get two buttons.

## Support

Questions, bug reports and ideas: [Discord server](https://discord.gg/bQeNQPHVcR) or [GitHub issues](https://github.com/uwemanfred64-png/ReadAllNotificationsButtonv2/issues).

## License

[MIT](LICENSE)
