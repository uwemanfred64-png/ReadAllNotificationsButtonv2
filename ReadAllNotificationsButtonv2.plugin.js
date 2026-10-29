/**
 * @name ReadAllNotificationsButtonv2
 * @author uwemanfred64-png
 * @description Adds a "read all" button to the server list that marks every notification as read at once, and a button to the mentions popout that clears all mentions. Includes a counter, Shift+click to read everything, middle click for the current server, a keybind, folders in the context menu, a server black list, timed and automatic reading, reading only older messages, keeping channels with mentions unread, excluded channels, active hours, statistics, one-click updates and 30 selectable languages. No library needed.
 * @version 3.0.0
 * @invite bQeNQPHVcR
 * @source https://github.com/uwemanfred64-png/ReadAllNotificationsButtonv2
 * @website https://github.com/uwemanfred64-png/ReadAllNotificationsButtonv2
 * @updateUrl https://raw.githubusercontent.com/uwemanfred64-png/ReadAllNotificationsButtonv2/main/ReadAllNotificationsButtonv2.plugin.js
 */

const ACK_CHUNK = 100;
const DM_DELAY = 1000;
const MENTION_DELAY = 1000;
const AUTO_DELAY = 5000;
const START_DELAY = 3000;
const REFRESH_DELAY = 100;
const FOLDER_NAME_LENGTH = 40;
const DISCORD_EPOCH = 1420070400000n;
const MENTIONS_TAB = 1;
const MINUTE = 60000;
const HOUR = 60 * MINUTE;
const OLDER_THAN = [0, 1, 6, 24];
const TOOLTIP_NAMES = 5;
const PARENT_DEPTH = 3;
const INTERVALS = [0, 5, 15, 30, 60];
const MIDDLE_BUTTON = 1;
const DAY = 24 * HOUR;
const CONFIRM_MODES = ["never", "always", "5", "10", "25"];
const UPDATE_URL = "https://raw.githubusercontent.com/uwemanfred64-png/ReadAllNotificationsButtonv2/main/ReadAllNotificationsButtonv2.plugin.js";
const UPDATE_DELAY = 10000;
const UPDATE_INTERVAL = 6 * HOUR;
const FILE_NAME = "ReadAllNotificationsButtonv2.plugin.js";

const defaults = {
    general: { language: "auto", addClearButton: true, confirm: "never", checkUpdates: true, clearMarksRead: false },
    batch: { guilds: true, muted: false, dms: false },
    extras: { label: "read all", buttonStyle: "text", badgeMode: "mentions", olderThan: 0, keepMentions: false, hideWhenEmpty: false, toast: true, autoMuted: false, readOnStart: false, readOnLeave: false, interval: 0, activeFrom: -1, activeTo: -1, hotkey: [], clearHotkey: [] },
};

const modifiers = { Control: "ctrlKey", Shift: "shiftKey", Alt: "altKey", Meta: "metaKey" };

function el(tag, props = {}, ...children) {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children.filter(c => c != null && c !== false && c !== ""));
    return node;
}

function source(fn, depth = 0) {
    if (depth > 3 || fn == null) return "";
    if (typeof fn === "function") return Function.prototype.toString.call(fn);
    if (typeof fn === "object") return source(fn.type ?? fn.render, depth + 1);
    return "";
}

function format(text, values) {
    return text.replace(/\{(\w+)\}/g, (match, key) => (key in values ? String(values[key]) : match));
}

function first(className) {
    return (className ?? "").split(" ")[0];
}

function classMap(Webpack, ...names) {
    const find = (m, name) => Object.values(m).find(v => typeof v === "string" && v.startsWith(`${name}_`));
    const module = Webpack.getModule(m => {
        if (!m || typeof m !== "object" || Array.isArray(m)) return false;
        try {
            return names.every(name => find(m, name));
        } catch {
            return false;
        }
    });
    return module ? Object.fromEntries(names.map(name => [name, find(module, name)])) : null;
}

function snowflakeAt(time) {
    return String((BigInt(Math.floor(time)) - DISCORD_EPOCH) << 22n);
}

function matchesHotkey(event, combo) {
    if (!Array.isArray(combo) || !combo.length || event.repeat) return false;
    for (const [name, prop] of Object.entries(modifiers)) {
        if (!!event[prop] !== combo.includes(name)) return false;
    }
    const keys = combo.filter(k => !(k in modifiers));
    if (keys.length !== 1) return false;
    const key = keys[0].toLowerCase();
    const code = (event.code ?? "").toLowerCase();
    return (event.key ?? "").toLowerCase() === key || code === `key${key}` || code === `digit${key}`;
}

function isNewer(remote, local) {
    const a = String(remote).split(".").map(Number);
    const b = String(local).split(".").map(Number);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
    }
    return false;
}

function checkIcon(size) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    for (const [key, value] of Object.entries({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2.5", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" })) svg.setAttribute(key, value);
    for (const d of ["M18 6 7 17l-5-5", "m22 10-7.5 7.5L13 16"]) {
        const path = document.createElementNS(ns, "path");
        path.setAttribute("d", d);
        svg.append(path);
    }
    return svg;
}

function closeIcon(size) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("width", size);
    svg.setAttribute("height", size);
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(ns, "path");
    path.setAttribute("fill", "currentColor");
    path.setAttribute("d", "M17.3 18.7a1 1 0 0 0 1.4-1.4L13.42 12l5.3-5.3a1 1 0 0 0-1.42-1.4L12 10.58l-5.3-5.3a1 1 0 0 0-1.4 1.42L10.58 12l-5.3 5.3a1 1 0 1 0 1.42 1.4L12 13.42l5.3 5.3Z");
    svg.append(path);
    return svg;
}

module.exports = class ReadAllNotificationsButtonv2 {
    constructor(meta) {
        this.api = new BdApi(meta.name);
        this.version = meta.version;
        this.fileName = meta.filename ?? FILE_NAME;
        this.timers = new Set();
        this.autoQueue = new Set();
        this.refresh = this.refresh.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onMessage = this.onMessage.bind(this);
        this.onGuildChange = this.onGuildChange.bind(this);
    }

    get t() {
        const chosen = this.settings?.general.language;
        const locale = (chosen && chosen !== "auto" ? chosen : this.stores?.Locale?.locale ?? document.documentElement.lang ?? "en").toLowerCase();
        const exact = Object.keys(labels).find(key => key.toLowerCase() === locale);
        const base = exact ?? (locale.split("-")[0] in labels ? locale.split("-")[0] : "en");
        return { ...labels.en, ...labels[base] };
    }

    start() {
        const { Webpack, Data, DOM } = this.api;
        const store = name => Webpack.getStore(name);

        this.stores = {
            SortedGuild: store("SortedGuildStore"),
            Guild: store("GuildStore"),
            GuildReadState: store("GuildReadStateStore"),
            ReadState: store("ReadStateStore"),
            UserGuildSettings: store("UserGuildSettingsStore"),
            Channel: store("ChannelStore"),
            GuildChannel: store("GuildChannelStore"),
            ActiveJoinedThreads: store("ActiveJoinedThreadsStore"),
            RecentMentions: store("RecentMentionsStore"),
            SelectedGuild: store("SelectedGuildStore"),
            Locale: store("LocaleStore"),
        };

        const functions = module => (module ? Object.values(module).filter(f => typeof f === "function") : []);
        const ackFns = functions(Webpack.getBySource('type:"CHANNEL_ACK",channelId', 'type:"BULK_ACK",channels:', { defaultExport: false }));
        this.bulkAck = ackFns.find(f => source(f).includes('type:"BULK_ACK"'));
        this.ack = ackFns.find(f => source(f).includes('type:"CHANNEL_ACK"'));
        this.markGuildsRead = functions(Webpack.getBySource("GUILD_ONBOARDING_QUESTION", "getActiveJoinedThreadsForGuild", "getVocalChannelIds", { defaultExport: false }))
            .find(f => source(f).includes("GUILD_ONBOARDING_QUESTION"));

        this.readStateTypes = Webpack.getModule(m => typeof m === "object" && m?.CHANNEL === 0 && "GUILD_EVENT" in m && "NOTIFICATION_CENTER" in m, { searchExports: true }) ?? { CHANNEL: 0, GUILD_EVENT: 1 };
        this.mentionsTab = Webpack.getModule(m => typeof m === "object" && m?.MENTIONS === MENTIONS_TAB && "UNREADS" in m && "FOR_YOU" in m, { searchExports: true })?.MENTIONS ?? MENTIONS_TAB;
        this.mentionActions = Webpack.getByKeys("deleteRecentMention", "fetchRecentMentions");
        this.dispatcher = Webpack.getByKeys("dispatch", "subscribe", "register", { searchExports: true });

        this.cls = {
            item: classMap(Webpack, "listItem", "isCurrentUserConnected"),
            icon: classMap(Webpack, "wrapper", "childWrapper", "childWrapperNoHoverBg", "acronym"),
            separator: classMap(Webpack, "guildSeparator", "fullWidth"),
            inbox: classMap(Webpack, "header", "headerTabs", "controls", "inboxIcon"),
        };

        const { SortedGuild, Guild, GuildReadState, ReadState, Channel, GuildChannel } = this.stores;
        if (!SortedGuild || !Guild || !GuildReadState || !ReadState || !Channel || !GuildChannel || !(this.markGuildsRead || this.bulkAck)) {
            this.api.UI.showToast(`${this.api.name ?? "ReadAllNotificationsButtonv2"}: Discord modules not found, the plugin needs an update.`, { type: "error" });
            this.stores = null;
            return;
        }

        const saved = Data.load("settings") ?? {};
        if (saved.extras?.badge === false && !saved.extras.badgeMode) saved.extras.badgeMode = "off";
        if (saved.general && typeof saved.general.confirmClear === "boolean" && !saved.general.confirm) saved.general.confirm = saved.general.confirmClear ? "always" : "never";
        this.settings = Object.fromEntries(Object.entries(defaults).map(([group, values]) => [
            group,
            Object.fromEntries(Object.entries(values).map(([key, value]) => [key, saved[group]?.[key] ?? value])),
        ]));
        const channelBlacklist = Data.load("channelBlacklist");
        this.channelBlacklist = Array.isArray(channelBlacklist) ? channelBlacklist : [];
        const blacklist = Data.load("blacklist");
        this.blacklist = Array.isArray(blacklist) ? blacklist : [];
        this.stats = { servers: 0, dms: 0, mentions: 0, ...Data.load("stats") };

        DOM.addStyle("main", this.css());

        for (const s of [GuildReadState, ReadState, this.stores.RecentMentions]) s?.addChangeListener(this.refresh);
        this.lastGuild = this.stores.SelectedGuild?.getGuildId() ?? null;
        this.stores.SelectedGuild?.addChangeListener(this.onGuildChange);
        window.addEventListener("keydown", this.onKeyDown, true);
        this.dispatcher?.subscribe("MESSAGE_CREATE", this.onMessage);
        this.unpatchMenus = [
            this.api.ContextMenu.patch?.("guild-context", (tree, props) => this.extendGuildMenu(tree, props)),
            this.api.ContextMenu.patch?.("channel-context", (tree, props) => this.extendChannelMenu(tree, props)),
            this.api.ContextMenu.patch?.("thread-context", (tree, props) => this.extendChannelMenu(tree, props)),
        ].filter(Boolean);

        this.sync();
        this.setupInterval();
        if (this.settings.extras.autoMuted) this.readGuilds(this.mutedGuilds());
        if (this.settings.extras.readOnStart) this.later(() => this.inActiveHours() && this.readBatch(), START_DELAY);
        this.later(() => this.checkForUpdate(), UPDATE_DELAY);
        this.updateTimer = setInterval(() => this.checkForUpdate(), UPDATE_INTERVAL);
    }

    stop() {
        for (const s of [this.stores?.GuildReadState, this.stores?.ReadState, this.stores?.RecentMentions]) s?.removeChangeListener(this.refresh);
        this.stores?.SelectedGuild?.removeChangeListener(this.onGuildChange);
        clearInterval(this.updateTimer);
        this.updateTimer = null;
        this.closeNotice?.();
        this.closeNotice = null;
        window.removeEventListener("keydown", this.onKeyDown, true);
        this.dispatcher?.unsubscribe("MESSAGE_CREATE", this.onMessage);
        for (const unpatch of this.unpatchMenus ?? []) unpatch();
        this.unpatchMenus = null;
        clearInterval(this.intervalTimer);
        this.intervalTimer = null;
        this.api.DOM.removeStyle("main");

        for (const timer of this.timers) clearTimeout(timer);
        this.timers.clear();
        clearTimeout(this.autoTimer);
        this.autoTimer = null;
        this.autoQueue.clear();
        clearTimeout(this.refreshTimer);
        this.refreshTimer = null;
        this.syncQueued = false;
        this.clearing = false;

        this.frame?.remove();
        this.clearButton?.remove();
        this.frame = this.clearButton = this.tooltip = null;
        this.settings = null;
    }

    observer() {
        if (!this.settings || this.syncQueued) return;
        this.syncQueued = true;
        queueMicrotask(() => {
            this.syncQueued = false;
            if (this.settings) this.sync();
        });
    }

    sync() {
        if (!this.frame?.isConnected) this.inject();
        this.syncInbox();
    }

    inject() {
        const nav = document.querySelector('[data-list-id="guildsnav"]') ?? document;
        const separatorClass = first(this.cls.separator?.guildSeparator);
        const separator = nav.querySelector(separatorClass ? `.${separatorClass}` : '[class*="guildSeparator"]');
        if (!separator) return;

        const itemClass = first(this.cls.item?.listItem);
        const anchor = (itemClass && separator.closest(`.${itemClass}`)) || separator.parentElement;
        anchor.before(this.frame ?? this.buildFrame());
        this.updateFrame();
    }

    buildFrame() {
        const { item, icon } = this.cls;
        const plain = !item || !icon;

        this.label = el("div", {
            className: [icon?.childWrapper, icon?.childWrapperNoHoverBg, "ranb-button"].filter(Boolean).join(" "),
            role: "button",
            tabIndex: 0,
        });
        this.badge = el("div", { className: "ranb-badge" });
        this.frame = el("div", { className: [item?.listItem, "ranb-frame", plain && "ranb-plain"].filter(Boolean).join(" ") },
            el("div", { className: [icon?.wrapper, "ranb-inner"].filter(Boolean).join(" ") }, this.label),
            this.badge
        );

        this.label.addEventListener("click", e => this.onButtonClick(e.shiftKey));
        this.label.addEventListener("keydown", e => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            this.onButtonClick(e.shiftKey);
        });
        this.label.addEventListener("contextmenu", e => this.openMenu(e));
        this.label.addEventListener("mousedown", e => {
            if (e.button === MIDDLE_BUTTON) e.preventDefault();
        });
        this.label.addEventListener("auxclick", e => {
            if (e.button !== MIDDLE_BUTTON) return;
            e.preventDefault();
            this.readCurrent();
        });
        this.label.addEventListener("mouseenter", () => this.updateTooltip());
        this.tooltip = this.api.UI.createTooltip?.(this.label, "", { side: "right" }) ?? null;
        if (this.tooltip?.labelElement) this.tooltip.labelElement.style.whiteSpace = "pre-line";
        return this.frame;
    }

    updateTooltip() {
        if (!this.tooltip?.labelElement || !this.settings) return;
        const { Guild, GuildReadState } = this.stores;
        const t = this.t;
        const unread = this.unreadGuilds();
        const names = unread.slice(0, TOOLTIP_NAMES).map(id => {
            const mentions = GuildReadState.getMentionCount(id);
            return `${Guild.getGuild(id)?.name ?? id}${mentions ? ` (${mentions})` : ""}`;
        });
        if (unread.length > TOOLTIP_NAMES) names.push(format(t.tooltip_more, { n: unread.length - TOOLTIP_NAMES }));
        const [head, ...hints] = format(t.tooltip_button, { servers: unread.length, dms: this.unreadDMs().length }).split("\n");
        const lines = [head, ...(names.length ? [names.join(", ")] : []), ...hints, t.tooltip_middle];
        this.tooltip.labelElement.textContent = lines.join("\n");
    }

    refresh() {
        if (this.refreshTimer || !this.settings) return;
        this.refreshTimer = setTimeout(() => {
            this.refreshTimer = null;
            this.updateFrame();
            this.syncInbox();
        }, REFRESH_DELAY);
    }

    updateFrame() {
        if (!this.frame || !this.settings) return;
        const { extras } = this.settings;
        const mentions = this.mentionCount();
        const count = extras.badgeMode === "unread" ? this.unreadGuilds().length + this.unreadDMs().length : mentions;
        const text = extras.label || defaults.extras.label;

        if (this.renderedLabel !== `${extras.buttonStyle}|${text}`) {
            this.renderedLabel = `${extras.buttonStyle}|${text}`;
            const parts = [];
            if (extras.buttonStyle !== "text") parts.push(checkIcon(14));
            if (extras.buttonStyle !== "icon") parts.push(el("span", { textContent: text }));
            this.label.replaceChildren(...parts);
            this.label.classList.toggle("ranb-with-icon", extras.buttonStyle !== "text");
            this.label.setAttribute("aria-label", text);
        }
        this.badge.textContent = count > 99 ? "99+" : String(count);
        this.badge.hidden = extras.badgeMode === "off" || count === 0;
        this.badge.classList.toggle("ranb-badge-unread", extras.badgeMode === "unread");
        this.frame.classList.toggle("ranb-hidden", extras.hideWhenEmpty && mentions === 0 && !this.hasUnread());
    }

    onButtonClick(everything) {
        const run = () => (everything ? this.readEverything() : this.readBatch());
        const count = everything
            ? this.allGuilds().filter(id => this.guildHasUnread(id)).length + this.unreadDMs().length
            : this.selectedGuilds().filter(id => this.guildHasUnread(id)).length + (this.settings.batch.dms ? this.pingedDMs().length : 0);
        if (this.needsConfirm(count)) this.confirm(this.t.modal_confirmnotifications, run);
        else run();
    }

    needsConfirm(count) {
        const mode = this.settings.general.confirm;
        if (mode === "always") return true;
        if (mode === "never" || !Number(mode)) return false;
        return count >= Number(mode);
    }

    inActiveHours() {
        const from = Number(this.settings?.extras.activeFrom);
        const to = Number(this.settings?.extras.activeTo);
        if (!(from >= 0) || !(to >= 0) || from === to) return true;
        const hour = new Date().getHours();
        return from < to ? hour >= from && hour < to : hour >= from || hour < to;
    }

    selectedGuilds() {
        const { batch } = this.settings;
        const guilds = [];
        if (batch.guilds) guilds.push(...this.unreadGuilds());
        if (batch.muted) guilds.push(...this.mutedGuilds());
        return guilds;
    }

    onGuildChange() {
        const current = this.stores.SelectedGuild?.getGuildId() ?? null;
        const previous = this.lastGuild;
        this.lastGuild = current;
        if (this.settings?.extras.readOnLeave && previous && previous !== current) this.readGuilds([previous]);
    }

    countStat(key, n) {
        if (!n || !this.stats) return;
        this.stats[key] = (this.stats[key] || 0) + n;
        this.api.Data.save("stats", this.stats);
    }

    resetStats() {
        this.stats = { servers: 0, dms: 0, mentions: 0 };
        this.api.Data.save("stats", this.stats);
    }

    async checkForUpdate() {
        if (!this.settings?.general.checkUpdates || this.closeNotice || !this.api.Net?.fetch) return;
        try {
            const response = await this.api.Net.fetch(UPDATE_URL);
            if (!response.ok) return;
            const code = await response.text();
            const remote = /@version\s+([\d.]+)/.exec(code)?.[1];
            if (!this.settings || !remote || !isNewer(remote, this.version) || !code.includes("@name ReadAllNotificationsButtonv2")) return;
            const t = this.t;
            this.closeNotice = this.api.UI.showNotice(format(t.notice_update, { version: remote }), {
                type: "info",
                buttons: [{ label: t.button_update, onClick: close => {
                    close?.();
                    this.closeNotice = null;
                    this.installUpdate(code, remote);
                } }],
            });
        } catch (err) {
            console.error("[ReadAllNotificationsButtonv2]", err);
        }
    }

    installUpdate(code, version) {
        const t = this.t;
        try {
            const fs = require("fs");
            const path = require("path");
            fs.writeFileSync(path.join(this.api.Plugins.folder, this.fileName), code);
            this.api.UI.showToast(format(t.toast_updated, { version }), { type: "success" });
        } catch (err) {
            this.api.UI.showToast(format(t.toast_updateFailed, { error: err?.message ?? String(err) }), { type: "error" });
        }
    }

    readBatch(quiet = false) {
        if (!this.settings) return;
        this.report(this.readGuilds(this.selectedGuilds()), this.settings.batch.dms ? this.readDMs(this.pingedDMs()) : 0, quiet);
    }

    readCurrent() {
        const current = this.stores.SelectedGuild?.getGuildId();
        this.report(current ? this.readGuilds([current]) : 0, 0);
    }

    setupInterval() {
        clearInterval(this.intervalTimer);
        this.intervalTimer = null;
        const minutes = Number(this.settings?.extras.interval) || 0;
        if (minutes > 0) this.intervalTimer = setInterval(() => this.inActiveHours() && this.readBatch(true), minutes * MINUTE);
    }

    extendGuildMenu(tree, props) {
        const id = props?.guild?.id;
        if (!id || !this.settings || !tree?.props) return;
        const group = this.api.ContextMenu.buildItem({
            type: "group",
            items: [{
                type: "toggle",
                id: "ranb-blacklist",
                label: this.t.context_blacklist,
                checked: this.blacklist.includes(id),
                action: () => this.saveBlacklist(this.blacklist.includes(id) ? this.blacklist.filter(g => g !== id) : [...this.blacklist, id]),
            }],
        });
        tree.props.children = [tree.props.children, group].flat();
    }

    extendChannelMenu(tree, props) {
        const id = props?.channel?.id;
        if (!id || !this.settings || !tree?.props) return;
        const group = this.api.ContextMenu.buildItem({
            type: "group",
            items: [{
                type: "toggle",
                id: "ranb-channel-blacklist",
                label: this.t.context_blacklist,
                checked: this.channelBlacklist.includes(id),
                action: () => this.saveChannelBlacklist(this.channelBlacklist.includes(id) ? this.channelBlacklist.filter(c => c !== id) : [...this.channelBlacklist, id]),
            }],
        });
        tree.props.children = [tree.props.children, group].flat();
    }

    saveChannelBlacklist(list) {
        this.channelBlacklist = [...new Set(list)];
        this.api.Data.save("channelBlacklist", this.channelBlacklist);
        this.refresh();
    }

    readEverything() {
        this.report(this.readGuilds(this.allGuilds()), this.readDMs(this.unreadDMs()));
    }

    report(servers, dms, quiet = false) {
        if (!this.settings?.extras.toast || (quiet && !servers && !dms)) return;
        const t = this.t;
        if (servers || dms) this.api.UI.showToast(format(t.toast_read, { servers, dms }), { type: "success" });
        else this.api.UI.showToast(t.toast_nothing, { type: "info" });
    }

    confirm(text, onConfirm) {
        this.api.UI.showConfirmationModal(this.t.modal_title, text, { danger: true, onConfirm });
    }

    openMenu(event) {
        const t = this.t;
        const current = this.stores.SelectedGuild?.getGuildId();
        const guilds = list => () => this.report(this.readGuilds(list()), 0);
        const dms = list => () => this.report(0, this.readDMs(list()));

        const folders = this.unreadFolders().map(folder => ({
            id: `folder-${folder.folderId}`,
            label: folder.name,
            action: guilds(() => folder.guildIds),
        }));

        const extras = [
            current && { id: "mark-current-read", label: t.context_current, action: guilds(() => [current]) },
            current && { id: "mark-others-read", label: t.context_others, action: guilds(() => this.allGuilds().filter(id => id !== current)) },
            folders.length && { type: "submenu", id: "mark-folder-read", label: t.context_folders, items: folders },
            { id: "mark-alldms-read", label: t.context_alldms, action: dms(() => this.unreadDMs()) },
        ].filter(Boolean);

        const { ContextMenu } = this.api;
        ContextMenu.open(event, ContextMenu.buildMenu([
            {
                type: "group",
                items: [
                    { id: "mark-unread-read", label: t.context_unreadguilds, action: guilds(() => this.unreadGuilds()) },
                    { id: "mark-pinged-read", label: t.context_pingedguilds, action: guilds(() => this.pingedGuilds()) },
                    { id: "mark-muted-read", label: t.context_mutedguilds, action: guilds(() => this.mutedGuilds()) },
                    { id: "mark-all-read", label: t.context_guilds, action: guilds(() => this.allGuilds()) },
                    { id: "mark-dms-read", label: t.context_dms, action: dms(() => this.pingedDMs()) },
                ],
            },
            { type: "group", items: extras },
        ]));
    }

    allGuilds() {
        const { SortedGuild, Guild } = this.stores;
        return (SortedGuild.getFlattenedGuildIds?.() ?? []).filter(id => Guild.getGuild(id));
    }

    isUnread(guildId) {
        const { GuildReadState } = this.stores;
        return GuildReadState.hasUnread(guildId) || GuildReadState.getMentionCount(guildId) > 0;
    }

    unreadGuilds() {
        return this.allGuilds().filter(id => this.isUnread(id));
    }

    pingedGuilds() {
        return this.allGuilds().filter(id => this.stores.GuildReadState.getMentionCount(id) > 0);
    }

    mutedGuilds() {
        const settings = this.stores.UserGuildSettings;
        return settings ? this.allGuilds().filter(id => settings.isMuted(id)) : [];
    }

    unreadFolders() {
        const { SortedGuild, Guild } = this.stores;
        return (SortedGuild.getGuildFolders?.() ?? [])
            .filter(folder => folder.folderId != null && folder.guildIds?.some(id => this.isUnread(id)))
            .map(folder => {
                let name = folder.folderName;
                if (!name) {
                    name = folder.guildIds.map(id => Guild.getGuild(id)?.name).filter(Boolean).join(", ");
                    if (name.length > FOLDER_NAME_LENGTH) name = `${name.slice(0, FOLDER_NAME_LENGTH).trimEnd()}...`;
                }
                return { folderId: folder.folderId, guildIds: folder.guildIds, name };
            });
    }

    channelIds(guildId) {
        const { GuildChannel, ActiveJoinedThreads } = this.stores;
        const ids = [...(GuildChannel.getSelectableChannelIds?.(guildId) ?? []), ...(GuildChannel.getVocalChannelIds?.(guildId) ?? [])];
        const threads = ActiveJoinedThreads?.getActiveJoinedThreadsForGuild?.(guildId) ?? {};
        for (const byParent of Object.values(threads)) ids.push(...Object.keys(byParent ?? {}));
        return ids;
    }

    channelUnread(id) {
        const { ReadState } = this.stores;
        return ReadState.hasUnread(id) || ReadState.getMentionCount(id) > 0;
    }

    guildHasUnread(guildId) {
        return this.isUnread(guildId) || this.channelIds(guildId).some(id => this.channelUnread(id));
    }

    privateChannels() {
        return (this.stores.Channel.getSortedPrivateChannels?.() ?? []).map(c => c.id).filter(Boolean);
    }

    pingedDMs() {
        return this.privateChannels().filter(id => this.stores.ReadState.getMentionCount(id) > 0);
    }

    unreadDMs() {
        return this.privateChannels().filter(id => this.channelUnread(id));
    }

    mentionCount() {
        const { GuildReadState, ReadState } = this.stores;
        let count = 0;
        for (const id of this.allGuilds()) count += GuildReadState.getMentionCount(id) || 0;
        for (const id of this.privateChannels()) count += ReadState.getMentionCount(id) || 0;
        return count;
    }

    hasUnread() {
        return this.allGuilds().some(id => this.isUnread(id));
    }

    cutoff() {
        const hours = Number(this.settings?.extras.olderThan) || 0;
        return hours > 0 ? snowflakeAt(Date.now() - hours * HOUR) : null;
    }

    skipsChannel(id, cutoff) {
        if (cutoff || this.settings.extras.keepMentions) return this.stores.ReadState.getMentionCount(id) > 0;
        return false;
    }

    isExcludedChannel(id) {
        let channel = this.stores.Channel.getChannel(id);
        for (let depth = 0; depth < PARENT_DEPTH && id; depth++) {
            if (this.channelBlacklist.includes(id)) return true;
            id = channel?.parent_id;
            channel = id ? this.stores.Channel.getChannel(id) : null;
        }
        return false;
    }

    needsChannelAcks(guildId) {
        if (this.cutoff() || this.settings.extras.keepMentions) return true;
        return this.channelBlacklist.length > 0 && this.channelIds(guildId).some(id => this.isExcludedChannel(id));
    }

    channelAcks(guildId) {
        const { Channel, ReadState } = this.stores;
        const { CHANNEL, GUILD_EVENT } = this.readStateTypes;
        const cutoff = this.cutoff();
        const acks = [];
        for (const id of this.channelIds(guildId)) {
            if (!this.channelUnread(id) || this.isExcludedChannel(id) || this.skipsChannel(id, cutoff)) continue;
            let messageId = Channel.getChannel(id)?.isForumLikeChannel?.() ? snowflakeAt(Date.now()) : ReadState.lastMessageId(id);
            if (cutoff && messageId && BigInt(messageId) > BigInt(cutoff)) messageId = cutoff;
            if (messageId) acks.push({ channelId: id, readStateType: CHANNEL, messageId });
        }
        const eventId = cutoff ? null : ReadState.lastMessageId(guildId, GUILD_EVENT);
        if (eventId) acks.push({ channelId: guildId, readStateType: GUILD_EVENT, messageId: eventId });
        return acks;
    }

    readGuilds(guildIds) {
        const { Guild } = this.stores;
        const ids = [...new Set(guildIds)].filter(id => id && !this.blacklist.includes(id) && Guild.getGuild(id) && this.guildHasUnread(id));
        if (!ids.length) return 0;

        const precise = ids.filter(id => !this.markGuildsRead || this.needsChannelAcks(id));
        const whole = ids.filter(id => !precise.includes(id));
        if (whole.length) {
            try {
                this.markGuildsRead(whole);
                this.countStat("servers", whole.length);
            } catch (err) {
                console.error("[ReadAllNotificationsButtonv2]", err);
                precise.push(...whole);
                whole.length = 0;
            }
        }

        let touched = 0;
        const acks = [];
        for (const id of precise) {
            const guildAcks = this.channelAcks(id);
            if (guildAcks.some(a => a.readStateType === this.readStateTypes.CHANNEL)) touched++;
            acks.push(...guildAcks);
        }
        for (let i = 0; i < acks.length; i += ACK_CHUNK) this.bulkAck?.(acks.slice(i, i + ACK_CHUNK));
        this.countStat("servers", touched);
        return touched + whole.length;
    }

    readDMs(channelIds) {
        if (!this.ack) return 0;
        const cutoff = this.cutoff();
        const unread = channelIds.filter(id => this.channelUnread(id) && !this.isExcludedChannel(id) && !this.skipsChannel(id, cutoff));
        unread.forEach((id, i) => this.later(() => {
            const last = this.stores.ReadState.lastMessageId(id);
            const messageId = cutoff && last && BigInt(last) > BigInt(cutoff) ? cutoff : undefined;
            this.ack(id, undefined, false, false, messageId);
        }, i * DM_DELAY));
        this.countStat("dms", unread.length);
        return unread.length;
    }

    later(fn, delay) {
        const timer = setTimeout(() => {
            this.timers.delete(timer);
            try {
                fn();
            } catch (err) {
                console.error("[ReadAllNotificationsButtonv2]", err);
            }
        }, delay);
        this.timers.add(timer);
    }

    onKeyDown(event) {
        if (!this.settings) return;
        const read = matchesHotkey(event, this.settings.extras.hotkey);
        const clear = !read && matchesHotkey(event, this.settings.extras.clearHotkey);
        if (!read && !clear) return;
        if (document.querySelector(".bd-keybind-wrap.recording")) return;
        const typing = event.target?.closest?.('input, textarea, [contenteditable="true"]');
        if (typing && !event.ctrlKey && !event.altKey && !event.metaKey) return;
        event.preventDefault();
        event.stopPropagation();
        if (read) this.onButtonClick(false);
        else if (this.mentionActions) this.onClearMentionsClick("all");
    }

    onMessage({ message, guildId, optimistic }) {
        if (!this.settings?.extras.autoMuted || optimistic || !message?.channel_id) return;
        const id = guildId ?? message.guild_id ?? this.stores.Channel.getChannel(message.channel_id)?.guild_id;
        if (!id || this.blacklist.includes(id) || !this.stores.UserGuildSettings?.isMuted(id)) return;

        this.autoQueue.add(id);
        if (this.autoTimer) return;
        this.autoTimer = setTimeout(() => {
            this.autoTimer = null;
            const ids = [...this.autoQueue];
            this.autoQueue.clear();
            if (this.settings?.extras.autoMuted && this.inActiveHours()) this.readGuilds(ids.filter(g => this.stores.UserGuildSettings.isMuted(g)));
        }, AUTO_DELAY);
    }

    syncInbox() {
        if (!this.settings) return;
        const headerClass = first(this.cls.inbox?.header);
        const controlsClass = first(this.cls.inbox?.controls);
        const controls = headerClass && controlsClass ? document.querySelector(`.${headerClass} .${controlsClass}`) : null;

        const wanted = controls
            && this.settings.general.addClearButton
            && this.mentionActions
            && this.stores.RecentMentions?.getMentions?.()?.length
            && this.isMentionsTab(controls);

        if (!wanted) {
            this.clearButton?.remove();
            return;
        }
        if (this.clearButton?.parentElement === controls) return;
        controls.append(this.clearButton ?? this.buildClearButton(controls));
    }

    isMentionsTab(node) {
        const stored = this.api.ReactUtils.getInternalInstance(node);
        const isCurrent = f => {
            while (f?.return) f = f.return;
            return f?.stateNode?.current === f;
        };
        let fiber = [stored, stored?.alternate].find(f => f && isCurrent(f)) ?? stored;
        for (let depth = 0; fiber && depth < 40; depth++, fiber = fiber.return) {
            const props = fiber.memoizedProps;
            if (props && typeof props === "object" && "setTab" in props && "tab" in props) return props.tab === this.mentionsTab;
        }
        return false;
    }

    buildClearButton(controls) {
        const sibling = controls.querySelector("button");
        const iconSize = sibling?.querySelector("svg")?.getAttribute("width") ?? "16";
        const button = el("button", { type: "button", className: sibling?.className ? `${sibling.className} ranb-clear` : "ranb-clear ranb-clear-plain" }, closeIcon(iconSize));
        button.setAttribute("aria-label", this.t.tooltip_clear);
        button.addEventListener("click", e => {
            e.stopPropagation();
            this.onClearMentionsClick("all");
        });
        button.addEventListener("contextmenu", e => {
            e.preventDefault();
            e.stopPropagation();
            this.openClearMenu(e);
        });
        this.api.UI.createTooltip?.(button, this.t.tooltip_clear, { side: "top" });
        this.clearButton = button;
        return button;
    }

    openClearMenu(event) {
        const t = this.t;
        const current = this.stores.SelectedGuild?.getGuildId();
        const { ContextMenu } = this.api;
        ContextMenu.open(event, ContextMenu.buildMenu([{
            type: "group",
            items: [
                { id: "ranb-clear-all", label: t.context_clear_all, action: () => this.onClearMentionsClick("all") },
                current && { id: "ranb-clear-server", label: t.context_clear_server, action: () => this.onClearMentionsClick("server") },
                { id: "ranb-clear-old", label: t.context_clear_old, action: () => this.onClearMentionsClick("old") },
            ].filter(Boolean),
        }]));
    }

    mentionsFor(scope) {
        const current = this.stores.SelectedGuild?.getGuildId();
        const oldest = snowflakeAt(Date.now() - DAY);
        return (this.stores.RecentMentions?.getMentions?.() ?? []).filter(m => {
            if (!m?.id) return false;
            if (scope === "server") return (m.guild_id ?? this.stores.Channel.getChannel(m.channel_id)?.guild_id) === current;
            if (scope === "old") return BigInt(m.id) < BigInt(oldest);
            return true;
        });
    }

    onClearMentionsClick(scope = "all") {
        const count = this.mentionsFor(scope).length;
        if (this.needsConfirm(count)) this.confirm(this.t.modal_confirmmentions, () => this.clearMentions(scope));
        else this.clearMentions(scope);
    }

    clearMentions(scope = "all") {
        const t = this.t;
        if (this.clearing) return this.api.UI.showToast(t.toast_alreadyclearing, { type: "error" });

        const mentions = this.mentionsFor(scope);
        if (!mentions.length) return this.api.UI.showToast(t.toast_noMentions, { type: "info" });

        this.clearing = true;
        this.api.UI.showToast(format(t.toast_clearing, { n: mentions.length }), { type: "info" });
        mentions.forEach((mention, i) => this.later(() => {
            Promise.resolve(this.mentionActions.deleteRecentMention(mention.id)).catch(err => console.error("[ReadAllNotificationsButtonv2]", err));
            if (i === mentions.length - 1) {
                this.clearing = false;
                this.countStat("mentions", mentions.length);
                if (this.settings?.general.clearMarksRead) this.readMentionChannels(mentions);
                this.api.UI.showToast(t.toast_cleared, { type: "success" });
            }
        }, i * MENTION_DELAY));
    }

    readMentionChannels(mentions) {
        const { ReadState } = this.stores;
        const acks = [...new Set(mentions.map(m => m.channel_id).filter(Boolean))]
            .filter(id => this.channelUnread(id) && !this.isExcludedChannel(id))
            .map(id => ({ channelId: id, readStateType: this.readStateTypes.CHANNEL, messageId: ReadState.lastMessageId(id) }))
            .filter(a => a.messageId);
        for (let i = 0; i < acks.length; i += ACK_CHUNK) this.bulkAck?.(acks.slice(i, i + ACK_CHUNK));
    }

    saveBlacklist(list) {
        this.blacklist = [...new Set(list)];
        this.api.Data.save("blacklist", this.blacklist);
        this.refresh();
    }

    getSettingsPanel() {
        if (!this.settings) return el("div", { textContent: "ReadAllNotificationsButtonv2 is not running." });

        const t = this.t;
        const { React, UI } = this.api;
        const { general, batch, extras } = this.settings;
        const toggle = (values, id, note) => ({ type: "switch", id, name: t[`set_${id}`], note, value: values[id] });
        const category = (id, settings, shown = true) => ({ type: "category", id, name: t[`settings_${id}`], collapsible: true, shown, settings });

        return UI.buildSettingsPanel({
            settings: [
                category("general", [
                    {
                        type: "dropdown",
                        id: "language",
                        name: t.set_language,
                        note: t.note_language,
                        value: general.language,
                        options: [{ label: t.language_auto, value: "auto" }, ...Object.entries(languageNames).map(([value, label]) => ({ label, value }))],
                    },
                    toggle(general, "addClearButton"),
                    toggle(general, "clearMarksRead"),
                    {
                        type: "dropdown",
                        id: "confirm",
                        name: t.set_confirm,
                        value: general.confirm,
                        options: CONFIRM_MODES.map(value => ({ label: Number(value) ? format(t.confirm_from, { n: value }) : t[`confirm_${value}`], value })),
                    },
                    toggle(general, "checkUpdates", t.note_checkUpdates),
                ]),
                category("batch", [toggle(batch, "guilds"), toggle(batch, "muted"), toggle(batch, "dms")]),
                category("extras", [
                    { type: "text", id: "label", name: t.set_label, value: extras.label, placeholder: defaults.extras.label },
                    { type: "dropdown", id: "buttonStyle", name: t.set_buttonStyle, value: extras.buttonStyle, options: ["text", "icon", "both"].map(value => ({ label: t[`style_${value}`], value })) },
                    { type: "dropdown", id: "badgeMode", name: t.set_badgeMode, value: extras.badgeMode, options: ["mentions", "unread", "off"].map(value => ({ label: t[`badge_${value}`], value })) },
                    {
                        type: "dropdown",
                        id: "olderThan",
                        name: t.set_olderThan,
                        note: t.note_olderThan,
                        value: extras.olderThan,
                        options: OLDER_THAN.map(value => ({ label: value ? format(t.olderThan_hours, { n: value }) : t.olderThan_off, value })),
                    },
                    toggle(extras, "keepMentions"),
                    toggle(extras, "hideWhenEmpty"),
                    toggle(extras, "toast"),
                    toggle(extras, "autoMuted", t.note_autoMuted),
                    toggle(extras, "readOnStart"),
                    toggle(extras, "readOnLeave"),
                    {
                        type: "dropdown",
                        id: "interval",
                        name: t.set_interval,
                        value: extras.interval,
                        options: INTERVALS.map(value => ({ label: value ? format(t.interval_minutes, { n: value }) : t.interval_off, value })),
                    },
                    { type: "dropdown", id: "activeFrom", name: t.set_activeFrom, note: t.note_activeHours, value: extras.activeFrom, options: hourOptions(t) },
                    { type: "dropdown", id: "activeTo", name: t.set_activeTo, value: extras.activeTo, options: hourOptions(t) },
                    { type: "keybind", id: "hotkey", name: t.set_hotkey, note: t.note_hotkey, value: extras.hotkey, clearable: true },
                    { type: "keybind", id: "clearHotkey", name: t.set_clearHotkey, value: extras.clearHotkey, clearable: true },
                ]),
                category("blacklist", [
                    { type: "custom", id: "guilds", name: "", note: t.blacklist_note, inline: false, children: React.createElement(GuildList, { plugin: this }) },
                    { type: "custom", id: "channels", name: t.channels_excluded, inline: false, children: React.createElement(ChannelList, { plugin: this }) },
                ], false),
                category("stats", [
                    { type: "custom", id: "stats", name: "", inline: false, children: React.createElement(StatsView, { plugin: this }) },
                ], false),
            ],
            onChange: (group, id, value) => {
                if (!this.settings?.[group] || !(id in defaults[group])) return;
                this.settings[group][id] = value;
                this.api.Data.save("settings", this.settings);
                if (group === "extras") this.updateFrame();
                if (id === "language") {
                    this.clearButton?.remove();
                    this.clearButton = null;
                }
                if (group === "general") this.syncInbox();
                if (id === "interval") this.setupInterval();
                if (id === "autoMuted" && value) this.readGuilds(this.mutedGuilds());
                if (id === "checkUpdates" && value) this.checkForUpdate();
            },
        });
    }

    css() {
        const tabs = first(this.cls.inbox?.headerTabs);
        const controls = first(this.cls.inbox?.controls);

        return `
${tabs ? `.${tabs} { flex: 1 0 auto; }` : ""}
${controls ? `.${controls} { display: flex; align-items: center; gap: 8px; }` : ""}
.ranb-frame { --guildbar-avatar-size: 48px; position: relative; }
.ranb-frame:active { transform: translateY(1px); }
.ranb-frame.ranb-hidden { display: none; }
#app-mount .ranb-frame, #app-mount .ranb-inner, #app-mount .ranb-button { height: 24px; }
#app-mount .ranb-inner { width: auto; min-width: var(--guildbar-avatar-size); }
.ranb-with-icon { display: flex; align-items: center; justify-content: center; gap: 4px; }
.ranb-with-icon svg { flex-shrink: 0; }
.ranb-button { box-sizing: border-box; padding: 0 4px; border-radius: 4px; font-size: 12px; line-height: 1.3; white-space: nowrap; cursor: pointer; }
.ranb-plain { display: flex; justify-content: center; width: 100%; margin-bottom: 8px; }
.ranb-plain .ranb-button { display: flex; align-items: center; justify-content: center; width: 100%; background: var(--background-base-low, #313338); color: var(--text-default, #dbdee1); }
.ranb-badge { position: absolute; top: -10px; right: calc(50% - var(--guildbar-avatar-size) / 2 - 10px); min-width: 16px; height: 16px; padding: 0 4px; box-sizing: border-box; border-radius: 8px; background: var(--status-danger, #f23f43); color: #fff; font-size: 12px; font-weight: 700; line-height: 16px; text-align: center; pointer-events: none; box-shadow: 0 0 0 3px var(--background-base-lowest, #1e1f22); }
.ranb-badge[hidden] { display: none; }
.ranb-badge-unread { background: var(--background-mod-strong, #4e5058); }
.ranb-clear { flex-shrink: 0; }
.ranb-clear-plain { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 50%; background: var(--background-mod-normal, rgba(78, 80, 88, 0.3)); color: var(--interactive-normal, #b5bac1); cursor: pointer; }
.ranb-clear-plain:hover { color: var(--interactive-hover, #dbdee1); }
.ranb-guilds { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
.ranb-guild { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; overflow: hidden; background: var(--background-base-low, #313338); color: var(--text-default, #dbdee1); font-size: 12px; font-weight: 500; cursor: pointer; transition: opacity 0.15s, filter 0.15s; }
.ranb-guild img { width: 100%; height: 100%; object-fit: cover; }
.ranb-guild.ranb-off { opacity: 0.3; filter: grayscale(1); }
.ranb-guild-actions { display: flex; flex-direction: column; gap: 8px; }
.ranb-channels { color: var(--text-muted, #949ba4); }
.ranb-guild-action { display: flex; align-items: center; justify-content: space-between; gap: 16px; color: var(--text-default, #dbdee1); font-size: 14px; }
`;
    }
};

function hourOptions(t) {
    return [{ label: t.hours_any, value: -1 }, ...Array.from({ length: 24 }, (_, h) => ({ label: `${String(h).padStart(2, "0")}:00`, value: h }))];
}

function StatsView({ plugin }) {
    const { React, Components } = BdApi;
    const [stats, setStats] = React.useState({ ...plugin.stats });
    const t = plugin.t;
    const reset = () => {
        plugin.resetStats();
        setStats({ ...plugin.stats });
    };
    const Button = Components?.Button;
    return React.createElement("div", { className: "ranb-guild-action" },
        React.createElement("span", null, format(t.stats_text, stats)),
        Button ? React.createElement(Button, { color: Button.Colors?.PRIMARY, onClick: reset }, t.button_reset) : React.createElement("button", { onClick: reset }, t.button_reset)
    );
}

function ChannelList({ plugin }) {
    const { React, Components } = BdApi;
    const [list, setList] = React.useState(plugin.channelBlacklist);
    const t = plugin.t;
    const { Channel, Guild } = plugin.stores;
    const names = list.map(id => {
        const channel = Channel.getChannel(id);
        const guild = channel?.guild_id ? Guild.getGuild(channel.guild_id) : null;
        return channel ? `#${channel.name}${guild ? ` (${guild.name})` : ""}` : id;
    });
    const clear = () => {
        plugin.saveChannelBlacklist([]);
        setList([]);
    };
    const Button = Components?.Button;

    return React.createElement("div", { className: "ranb-guild-action" },
        React.createElement("span", { className: "ranb-channels" }, names.length ? names.join(", ") : t.channels_none),
        names.length ? (Button ? React.createElement(Button, { color: Button.Colors?.PRIMARY, onClick: clear }, t.button_clear) : React.createElement("button", { onClick: clear }, t.button_clear)) : null
    );
}

function GuildList({ plugin }) {
    const { React, Components } = BdApi;
    const [blacklist, setBlacklist] = React.useState(plugin.blacklist);
    const t = plugin.t;
    const ids = plugin.allGuilds();
    const update = list => {
        plugin.saveBlacklist(list);
        setBlacklist(plugin.blacklist);
    };

    const icon = id => {
        const guild = plugin.stores.Guild.getGuild(id);
        const off = blacklist.includes(id);
        const url = guild.icon && (guild.getIconURL?.(80) ?? `https://cdn.discordapp.com/icons/${id}/${guild.icon}.webp?size=80`);
        const toggle = () => update(off ? blacklist.filter(g => g !== id) : [...blacklist, id]);
        const render = (props = {}) => React.createElement("div", {
            ...props,
            className: off ? "ranb-guild ranb-off" : "ranb-guild",
            role: "checkbox",
            "aria-checked": !off,
            "aria-label": guild.name,
            tabIndex: 0,
            onClick: toggle,
            onKeyDown: e => {
                if (e.key === "Enter" || e.key === " ") toggle();
            },
        }, url ? React.createElement("img", { src: url, alt: "" }) : guild.acronym);

        return Components?.Tooltip
            ? React.createElement(Components.Tooltip, { key: id, text: guild.name }, render)
            : React.createElement(React.Fragment, { key: id }, render());
    };

    const Button = Components?.Button;
    const action = (label, text, color, onClick) => React.createElement("div", { className: "ranb-guild-action" },
        React.createElement("span", null, label),
        Button ? React.createElement(Button, { color, onClick }, text) : React.createElement("button", { onClick }, text)
    );

    return React.createElement("div", null,
        React.createElement("div", { className: "ranb-guilds" }, ids.map(icon)),
        React.createElement("div", { className: "ranb-guild-actions" },
            action(t.blacklist_enable, t.button_enable, Button?.Colors?.GREEN, () => update([])),
            action(t.blacklist_disable, t.button_disable, Button?.Colors?.PRIMARY, () => update([...blacklist, ...ids]))
        )
    );
}

const languageNames = {
    en: "English",
    bg: "Български",
    cs: "Čeština",
    da: "Dansk",
    de: "Deutsch",
    el: "Ελληνικά",
    es: "Español",
    fi: "Suomi",
    fr: "Français",
    hi: "हिन्दी",
    hr: "Hrvatski",
    hu: "Magyar",
    id: "Bahasa Indonesia",
    it: "Italiano",
    ja: "日本語",
    ko: "한국어",
    lt: "Lietuvių",
    nl: "Nederlands",
    no: "Norsk",
    pl: "Polski",
    "pt-BR": "Português (Brasil)",
    ro: "Română",
    ru: "Русский",
    "sv-SE": "Svenska",
    th: "ไทย",
    tr: "Türkçe",
    uk: "Українська",
    vi: "Tiếng Việt",
    "zh-CN": "简体中文",
    "zh-TW": "繁體中文",
};

const labels = {
    en: {
        context_unreadguilds: "Unread Servers",
        context_pingedguilds: "Pinged Servers",
        context_mutedguilds: "Muted Servers",
        context_guilds: "All Servers",
        context_dms: "Direct Messages",
        context_current: "Current Server",
        context_others: "All Servers except the current one",
        context_folders: "Folders",
        context_alldms: "All unread Direct Messages",
        modal_title: "Confirm",
        modal_confirmnotifications: "Are you sure you want to mark all unread notifications as read?",
        modal_confirmmentions: "Are you sure you want to remove all mentions from the list?",
        tooltip_clear: "Close (All)",
        tooltip_button: "Unread: {servers} servers · {dms} DMs\nShift+click marks everything as read",
        toast_alreadyclearing: "Already clearing mentions, please wait",
        toast_clearing: "Clearing {n} mentions, this takes about {n} seconds",
        toast_cleared: "All recent mentions have been cleared",
        toast_read: "Marked as read · Servers: {servers} · DMs: {dms}",
        toast_nothing: "Nothing was unread",
        settings_general: "Settings",
        settings_batch: "Left click marks the following as read",
        settings_extras: "Extras",
        settings_blacklist: "Server Black List",
        set_addClearButton: "Adds a button to the mentions popout that clears all mentions",
        set_guilds: "Unread servers",
        set_muted: "Muted servers",
        set_dms: "Direct messages with mentions",
        set_label: "Button text",
        set_hideWhenEmpty: "Hides the button while nothing is unread",
        set_toast: "Shows how much was marked as read",
        set_autoMuted: "Automatically marks muted servers as read",
        note_autoMuted: "New messages in muted servers are marked as read after 5 seconds. The black list applies.",
        set_readOnStart: "Marks everything as read when Discord starts (uses the left click selection)",
        set_hotkey: "Keybind",
        note_hotkey: "Does the same as a left click on the button.",
        blacklist_note: "Greyed out servers are never marked as read. Click a server to toggle it.",
        blacklist_enable: "Enable for all servers",
        blacklist_disable: "Disable for all servers",
        button_enable: "Enable",
        button_disable: "Disable",
        set_language: "Language",
        note_language: "Applies right away. Reopen the settings to see them in the new language.",
        language_auto: "Automatic (Discord language)",
        set_badgeMode: "Counter on the button",
        badge_mentions: "Mentions",
        badge_unread: "Unread servers and DMs",
        badge_off: "Off",
        set_interval: "Mark as read automatically every",
        interval_off: "Never",
        interval_minutes: "{n} minutes",
        context_blacklist: "Exclude from read all",
        tooltip_middle: "Middle click marks only the current server as read",
        set_olderThan: "Only mark messages as read that are older than",
        note_olderThan: "Newer messages stay unread. Channels with mentions always stay unread in this mode.",
        olderThan_off: "All messages",
        olderThan_hours: "{n} h",
        set_keepMentions: "Keep channels with mentions unread",
        channels_excluded: "Excluded channels (right click a channel to add)",
        channels_none: "None",
        button_clear: "Remove all",
        tooltip_more: "+{n} more",
        set_confirm: "Ask before marking or clearing",
        confirm_never: "Never",
        confirm_always: "Always",
        confirm_from: "When {n} or more at once",
        set_clearMarksRead: "Clearing mentions also marks their channels as read",
        set_checkUpdates: "Check for updates",
        note_checkUpdates: "Looks on GitHub for a new version and offers to install it with one click.",
        notice_update: "ReadAllNotificationsButtonv2 {version} is available.",
        button_update: "Update",
        toast_updated: "Updated to {version}",
        toast_updateFailed: "Update failed: {error}",
        set_buttonStyle: "Button style",
        style_text: "Text",
        style_icon: "Icon",
        style_both: "Icon and text",
        set_readOnLeave: "Mark a server as read when you switch to another one",
        set_activeFrom: "Automatic reading from",
        set_activeTo: "Automatic reading until",
        note_activeHours: "Applies to the interval, muted servers and the start. The same hour or \"Any time\" means always.",
        hours_any: "Any time",
        set_clearHotkey: "Keybind for clearing mentions",
        context_clear_all: "All mentions",
        context_clear_server: "Mentions from this server",
        context_clear_old: "Mentions older than one day",
        settings_stats: "Statistics",
        stats_text: "Marked as read: {servers} servers, {dms} DMs · Mentions cleared: {mentions}",
        button_reset: "Reset",
        toast_noMentions: "No matching mentions",
    },
    de: {
        context_unreadguilds: "Ungelesene Server",
        context_pingedguilds: "Gepingte Server",
        context_mutedguilds: "Stummgeschaltete Server",
        context_guilds: "Alle Server",
        context_dms: "Direktnachrichten",
        context_current: "Aktueller Server",
        context_others: "Alle Server außer dem aktuellen",
        context_folders: "Ordner",
        context_alldms: "Alle ungelesenen Direktnachrichten",
        modal_title: "Bestätigen",
        modal_confirmnotifications: "Willst du wirklich alle ungelesenen Benachrichtigungen als gelesen markieren?",
        modal_confirmmentions: "Willst du wirklich alle Erwähnungen aus der Liste entfernen?",
        tooltip_clear: "Schließen (Alle)",
        tooltip_button: "Ungelesen: {servers} Server · {dms} DMs\nUmschalt+Klick markiert alles als gelesen",
        toast_alreadyclearing: "Es werden schon Erwähnungen entfernt, bitte warten",
        toast_clearing: "Entferne {n} Erwähnungen, das dauert etwa {n} Sekunden",
        toast_cleared: "Alle Erwähnungen wurden entfernt",
        toast_read: "Als gelesen markiert · Server: {servers} · DMs: {dms}",
        toast_nothing: "Es gab nichts Ungelesenes",
        settings_general: "Einstellungen",
        settings_batch: "Linksklick markiert Folgendes als gelesen",
        settings_extras: "Zusatzfunktionen",
        settings_blacklist: "Server-Ausnahmen",
        set_addClearButton: "Button zum Entfernen aller Erwähnungen im Erwähnungen-Popout anzeigen",
        set_guilds: "Ungelesene Server",
        set_muted: "Stummgeschaltete Server",
        set_dms: "Direktnachrichten mit Erwähnungen",
        set_label: "Text auf dem Button",
        set_hideWhenEmpty: "Button ausblenden, solange nichts ungelesen ist",
        set_toast: "Anzeigen, wie viel als gelesen markiert wurde",
        set_autoMuted: "Stummgeschaltete Server automatisch als gelesen markieren",
        note_autoMuted: "Neue Nachrichten in stummgeschalteten Servern werden nach 5 Sekunden als gelesen markiert. Server-Ausnahmen gelten.",
        set_readOnStart: "Beim Start von Discord alles als gelesen markieren (Auswahl wie beim Linksklick)",
        set_hotkey: "Tastenkürzel",
        note_hotkey: "Löst dasselbe aus wie ein Linksklick auf den Button.",
        blacklist_note: "Ausgegraute Server werden nie als gelesen markiert. Ein Klick auf einen Server schaltet um.",
        blacklist_enable: "Für alle Server aktivieren",
        blacklist_disable: "Für alle Server deaktivieren",
        button_enable: "Aktivieren",
        button_disable: "Deaktivieren",
        set_language: "Sprache",
        note_language: "Gilt sofort. Öffne die Einstellungen neu, um sie in der neuen Sprache zu sehen.",
        language_auto: "Automatisch (Discord-Sprache)",
        set_badgeMode: "Zähler am Button",
        badge_mentions: "Erwähnungen",
        badge_unread: "Ungelesene Server und DMs",
        badge_off: "Aus",
        set_interval: "Automatisch als gelesen markieren alle",
        interval_off: "Nie",
        interval_minutes: "{n} Minuten",
        context_blacklist: "Von read all ausnehmen",
        tooltip_middle: "Mittelklick markiert nur den aktuellen Server als gelesen",
        set_olderThan: "Nur Nachrichten als gelesen markieren, die älter sind als",
        note_olderThan: "Neuere Nachrichten bleiben ungelesen. Kanäle mit Erwähnungen bleiben in diesem Modus immer ungelesen.",
        olderThan_off: "Alle Nachrichten",
        olderThan_hours: "{n} Std.",
        set_keepMentions: "Kanäle mit Erwähnungen ungelesen lassen",
        channels_excluded: "Ausgenommene Kanäle (Rechtsklick auf einen Kanal zum Hinzufügen)",
        channels_none: "Keine",
        button_clear: "Alle entfernen",
        tooltip_more: "+{n} weitere",
        set_confirm: "Vor dem Markieren und Entfernen nachfragen",
        confirm_never: "Nie",
        confirm_always: "Immer",
        confirm_from: "Ab {n} auf einmal",
        set_clearMarksRead: "Beim Entfernen von Erwähnungen auch ihre Kanäle als gelesen markieren",
        set_checkUpdates: "Nach Updates suchen",
        note_checkUpdates: "Sucht auf GitHub nach einer neuen Version und bietet die Installation mit einem Klick an.",
        notice_update: "ReadAllNotificationsButtonv2 {version} ist verfügbar.",
        button_update: "Aktualisieren",
        toast_updated: "Auf {version} aktualisiert",
        toast_updateFailed: "Update fehlgeschlagen: {error}",
        set_buttonStyle: "Aussehen des Buttons",
        style_text: "Text",
        style_icon: "Symbol",
        style_both: "Symbol und Text",
        set_readOnLeave: "Server als gelesen markieren, wenn du zu einem anderen wechselst",
        set_activeFrom: "Automatisch lesen ab",
        set_activeTo: "Automatisch lesen bis",
        note_activeHours: "Gilt für das Intervall, stummgeschaltete Server und den Start. Gleiche Uhrzeit oder „Jederzeit“ heißt immer.",
        hours_any: "Jederzeit",
        set_clearHotkey: "Tastenkürzel zum Entfernen der Erwähnungen",
        context_clear_all: "Alle Erwähnungen",
        context_clear_server: "Erwähnungen aus diesem Server",
        context_clear_old: "Erwähnungen älter als ein Tag",
        settings_stats: "Statistik",
        stats_text: "Als gelesen markiert: {servers} Server, {dms} Direktnachrichten · Erwähnungen entfernt: {mentions}",
        button_reset: "Zurücksetzen",
        toast_noMentions: "Keine passenden Erwähnungen",
    },
    bg: {
        context_unreadguilds: "Непрочетени сървъри",
        context_pingedguilds: "Сървъри със споменавания",
        context_mutedguilds: "Заглушени сървъри",
        context_guilds: "Всички сървъри",
        context_dms: "Лични съобщения",
        context_current: "Текущ сървър",
        context_others: "Всички сървъри без текущия",
        context_folders: "Папки",
        context_alldms: "Всички непрочетени лични съобщения",
        modal_title: "Потвърждение",
        modal_confirmnotifications: "Наистина ли искате да отбележите всички непрочетени известия като прочетени?",
        modal_confirmmentions: "Наистина ли искате да премахнете всички споменавания от списъка?",
        tooltip_clear: "Затвори (всички)",
        tooltip_button: "Непрочетени: сървъри {servers} · ЛС {dms}\nShift+клик отбелязва всичко като прочетено",
        toast_alreadyclearing: "Споменаванията вече се премахват, изчакайте",
        toast_clearing: "Премахване на споменавания ({n}), отнема около {n} сек.",
        toast_cleared: "Всички скорошни споменавания са премахнати",
        toast_read: "Отбелязано като прочетено · Сървъри: {servers} · ЛС: {dms}",
        toast_nothing: "Нямаше нищо непрочетено",
        settings_general: "Настройки",
        settings_batch: "Левият клик отбелязва като прочетено",
        settings_extras: "Допълнителни",
        settings_blacklist: "Черен списък със сървъри",
        set_addClearButton: "Добавя бутон в прозореца със споменавания, който ги премахва всички",
        set_guilds: "Непрочетени сървъри",
        set_muted: "Заглушени сървъри",
        set_dms: "Лични съобщения със споменавания",
        set_label: "Текст на бутона",
        set_hideWhenEmpty: "Скрива бутона, докато няма непрочетено",
        set_toast: "Показва колко е отбелязано като прочетено",
        set_autoMuted: "Автоматично отбелязва заглушените сървъри като прочетени",
        note_autoMuted: "Новите съобщения в заглушени сървъри се отбелязват като прочетени след 5 секунди. Черният списък важи.",
        set_readOnStart: "Отбелязва всичко като прочетено при стартиране на Discord (като левия клик)",
        set_hotkey: "Клавишна комбинация",
        note_hotkey: "Прави същото като ляв клик върху бутона.",
        blacklist_note: "Сивите сървъри никога не се отбелязват като прочетени. Кликнете върху сървър, за да превключите.",
        blacklist_enable: "Включи за всички сървъри",
        blacklist_disable: "Изключи за всички сървъри",
        button_enable: "Включи",
        button_disable: "Изключи",
        set_language: "Език",
        note_language: "Важи веднага. Отворете настройките отново, за да ги видите на новия език.",
        language_auto: "Автоматично (езикът на Discord)",
        set_badgeMode: "Брояч на бутона",
        badge_mentions: "Споменавания",
        badge_unread: "Непрочетени сървъри и ЛС",
        badge_off: "Изключен",
        set_interval: "Автоматично отбелязване като прочетено на всеки",
        interval_off: "Никога",
        interval_minutes: "{n} минути",
        context_blacklist: "Изключи от read all",
        tooltip_middle: "Среден клик отбелязва само текущия сървър като прочетен",
        set_olderThan: "Отбелязване като прочетени само на съобщения, по-стари от",
        note_olderThan: "По-новите съобщения остават непрочетени. Каналите със споменавания винаги остават непрочетени в този режим.",
        olderThan_off: "Всички съобщения",
        olderThan_hours: "{n} ч",
        set_keepMentions: "Каналите със споменавания остават непрочетени",
        channels_excluded: "Изключени канали (десен клик върху канал за добавяне)",
        channels_none: "Няма",
        button_clear: "Премахни всички",
        tooltip_more: "+{n} още",
        set_confirm: "Питане преди маркиране или изчистване",
        confirm_never: "Никога",
        confirm_always: "Винаги",
        confirm_from: "От {n} наведнъж",
        set_clearMarksRead: "Изчистването на споменавания отбелязва и техните канали като прочетени",
        set_checkUpdates: "Проверка за актуализации",
        note_checkUpdates: "Търси нова версия в GitHub и предлага инсталиране с едно щракване.",
        notice_update: "Налична е ReadAllNotificationsButtonv2 {version}.",
        button_update: "Актуализиране",
        toast_updated: "Актуализирано до {version}",
        toast_updateFailed: "Актуализацията не успя: {error}",
        set_buttonStyle: "Стил на бутона",
        style_text: "Текст",
        style_icon: "Икона",
        style_both: "Икона и текст",
        set_readOnLeave: "Отбелязване на сървър като прочетен при преминаване към друг",
        set_activeFrom: "Автоматично четене от",
        set_activeTo: "Автоматично четене до",
        note_activeHours: "Важи за интервала, заглушените сървъри и стартирането. Еднакъв час или „По всяко време“ означава винаги.",
        hours_any: "По всяко време",
        set_clearHotkey: "Клавишна комбинация за изчистване на споменавания",
        context_clear_all: "Всички споменавания",
        context_clear_server: "Споменавания от този сървър",
        context_clear_old: "Споменавания, по-стари от един ден",
        settings_stats: "Статистика",
        stats_text: "Отбелязани като прочетени: сървъри {servers}, лични съобщения {dms} · Изчистени споменавания: {mentions}",
        button_reset: "Нулиране",
        toast_noMentions: "Няма подходящи споменавания",
    },
    cs: {
        context_unreadguilds: "Nepřečtené servery",
        context_pingedguilds: "Servery se zmínkami",
        context_mutedguilds: "Ztlumené servery",
        context_guilds: "Všechny servery",
        context_dms: "Přímé zprávy",
        context_current: "Aktuální server",
        context_others: "Všechny servery kromě aktuálního",
        context_folders: "Složky",
        context_alldms: "Všechny nepřečtené přímé zprávy",
        modal_title: "Potvrdit",
        modal_confirmnotifications: "Opravdu chceš označit všechna nepřečtená oznámení jako přečtená?",
        modal_confirmmentions: "Opravdu chceš odebrat všechny zmínky ze seznamu?",
        tooltip_clear: "Zavřít (vše)",
        tooltip_button: "Nepřečteno: servery {servers} · DM {dms}\nShift+klik označí vše jako přečtené",
        toast_alreadyclearing: "Zmínky se už odebírají, počkej",
        toast_clearing: "Odebírání zmínek ({n}), potrvá asi {n} s",
        toast_cleared: "Všechny nedávné zmínky byly odebrány",
        toast_read: "Označeno jako přečtené · Servery: {servers} · DM: {dms}",
        toast_nothing: "Nic nebylo nepřečtené",
        settings_general: "Nastavení",
        settings_batch: "Levé kliknutí označí jako přečtené",
        settings_extras: "Doplňky",
        settings_blacklist: "Černá listina serverů",
        set_addClearButton: "Přidá do okna zmínek tlačítko, které odebere všechny zmínky",
        set_guilds: "Nepřečtené servery",
        set_muted: "Ztlumené servery",
        set_dms: "Přímé zprávy se zmínkami",
        set_label: "Text tlačítka",
        set_hideWhenEmpty: "Skrýt tlačítko, dokud není nic nepřečtené",
        set_toast: "Zobrazit, kolik bylo označeno jako přečtené",
        set_autoMuted: "Automaticky označovat ztlumené servery jako přečtené",
        note_autoMuted: "Nové zprávy na ztlumených serverech se po 5 sekundách označí jako přečtené. Platí černá listina.",
        set_readOnStart: "Při spuštění Discordu označit vše jako přečtené (jako levé kliknutí)",
        set_hotkey: "Klávesová zkratka",
        note_hotkey: "Udělá totéž jako levé kliknutí na tlačítko.",
        blacklist_note: "Šedé servery se nikdy neoznačí jako přečtené. Kliknutím na server přepneš.",
        blacklist_enable: "Zapnout pro všechny servery",
        blacklist_disable: "Vypnout pro všechny servery",
        button_enable: "Zapnout",
        button_disable: "Vypnout",
        set_language: "Jazyk",
        note_language: "Platí hned. Otevři nastavení znovu, abys je viděl v novém jazyce.",
        language_auto: "Automaticky (jazyk Discordu)",
        set_badgeMode: "Počítadlo na tlačítku",
        badge_mentions: "Zmínky",
        badge_unread: "Nepřečtené servery a DM",
        badge_off: "Vypnuto",
        set_interval: "Automaticky označit jako přečtené každých",
        interval_off: "Nikdy",
        interval_minutes: "{n} minut",
        context_blacklist: "Vyřadit z read all",
        tooltip_middle: "Prostřední tlačítko označí jen aktuální server jako přečtený",
        set_olderThan: "Označit jako přečtené jen zprávy starší než",
        note_olderThan: "Novější zprávy zůstanou nepřečtené. Kanály se zmínkami v tomto režimu vždy zůstanou nepřečtené.",
        olderThan_off: "Všechny zprávy",
        olderThan_hours: "{n} h",
        set_keepMentions: "Kanály se zmínkami nechat nepřečtené",
        channels_excluded: "Vyřazené kanály (přidáš pravým kliknutím na kanál)",
        channels_none: "Žádné",
        button_clear: "Odebrat vše",
        tooltip_more: "+{n} dalších",
        set_confirm: "Ptát se před označením nebo vymazáním",
        confirm_never: "Nikdy",
        confirm_always: "Vždy",
        confirm_from: "Od {n} najednou",
        set_clearMarksRead: "Vymazání zmínek označí i jejich kanály jako přečtené",
        set_checkUpdates: "Hledat aktualizace",
        note_checkUpdates: "Hledá novou verzi na GitHubu a nabídne instalaci jedním kliknutím.",
        notice_update: "ReadAllNotificationsButtonv2 {version} je k dispozici.",
        button_update: "Aktualizovat",
        toast_updated: "Aktualizováno na {version}",
        toast_updateFailed: "Aktualizace selhala: {error}",
        set_buttonStyle: "Styl tlačítka",
        style_text: "Text",
        style_icon: "Ikona",
        style_both: "Ikona a text",
        set_readOnLeave: "Označit server jako přečtený při přepnutí na jiný",
        set_activeFrom: "Automatické čtení od",
        set_activeTo: "Automatické čtení do",
        note_activeHours: "Platí pro interval, ztlumené servery a spuštění. Stejná hodina nebo „Kdykoli“ znamená vždy.",
        hours_any: "Kdykoli",
        set_clearHotkey: "Klávesová zkratka pro vymazání zmínek",
        context_clear_all: "Všechny zmínky",
        context_clear_server: "Zmínky z tohoto serveru",
        context_clear_old: "Zmínky starší než jeden den",
        settings_stats: "Statistika",
        stats_text: "Označeno jako přečtené: serverů {servers}, přímých zpráv {dms} · Vymazáno zmínek: {mentions}",
        button_reset: "Vynulovat",
        toast_noMentions: "Žádné odpovídající zmínky",
    },
    da: {
        context_unreadguilds: "Ulæste servere",
        context_pingedguilds: "Servere med omtaler",
        context_mutedguilds: "Lydløse servere",
        context_guilds: "Alle servere",
        context_dms: "Direkte beskeder",
        context_current: "Nuværende server",
        context_others: "Alle servere undtagen den nuværende",
        context_folders: "Mapper",
        context_alldms: "Alle ulæste direkte beskeder",
        modal_title: "Bekræft",
        modal_confirmnotifications: "Er du sikker på, at du vil markere alle ulæste notifikationer som læst?",
        modal_confirmmentions: "Er du sikker på, at du vil fjerne alle omtaler fra listen?",
        tooltip_clear: "Luk (alle)",
        tooltip_button: "Ulæst: {servers} servere · {dms} DM'er\nShift+klik markerer alt som læst",
        toast_alreadyclearing: "Omtaler fjernes allerede, vent venligst",
        toast_clearing: "Fjerner {n} omtaler, det tager cirka {n} sekunder",
        toast_cleared: "Alle nylige omtaler er fjernet",
        toast_read: "Markeret som læst · Servere: {servers} · DM'er: {dms}",
        toast_nothing: "Der var intet ulæst",
        settings_general: "Indstillinger",
        settings_batch: "Venstreklik markerer følgende som læst",
        settings_extras: "Ekstra",
        settings_blacklist: "Sortliste over servere",
        set_addClearButton: "Tilføjer en knap i omtalevinduet, der fjerner alle omtaler",
        set_guilds: "Ulæste servere",
        set_muted: "Lydløse servere",
        set_dms: "Direkte beskeder med omtaler",
        set_label: "Knaptekst",
        set_hideWhenEmpty: "Skjuler knappen, så længe intet er ulæst",
        set_toast: "Viser, hvor meget der blev markeret som læst",
        set_autoMuted: "Markerer automatisk lydløse servere som læst",
        note_autoMuted: "Nye beskeder på lydløse servere markeres som læst efter 5 sekunder. Sortlisten gælder.",
        set_readOnStart: "Markerer alt som læst, når Discord starter (som venstreklik)",
        set_hotkey: "Genvejstast",
        note_hotkey: "Gør det samme som et venstreklik på knappen.",
        blacklist_note: "Grå servere markeres aldrig som læst. Klik på en server for at skifte.",
        blacklist_enable: "Aktivér for alle servere",
        blacklist_disable: "Deaktivér for alle servere",
        button_enable: "Aktivér",
        button_disable: "Deaktivér",
        set_language: "Sprog",
        note_language: "Gælder med det samme. Åbn indstillingerne igen for at se dem på det nye sprog.",
        language_auto: "Automatisk (Discords sprog)",
        set_badgeMode: "Tæller på knappen",
        badge_mentions: "Omtaler",
        badge_unread: "Ulæste servere og DM'er",
        badge_off: "Fra",
        set_interval: "Markér automatisk som læst hvert",
        interval_off: "Aldrig",
        interval_minutes: "{n} minutter",
        context_blacklist: "Udeluk fra read all",
        tooltip_middle: "Midterklik markerer kun den nuværende server som læst",
        set_olderThan: "Markér kun beskeder som læst, der er ældre end",
        note_olderThan: "Nyere beskeder forbliver ulæste. Kanaler med omtaler forbliver altid ulæste i denne tilstand.",
        olderThan_off: "Alle beskeder",
        olderThan_hours: "{n} t",
        set_keepMentions: "Lad kanaler med omtaler forblive ulæste",
        channels_excluded: "Udelukkede kanaler (højreklik på en kanal for at tilføje)",
        channels_none: "Ingen",
        button_clear: "Fjern alle",
        tooltip_more: "+{n} mere",
        set_confirm: "Spørg før markering eller rydning",
        confirm_never: "Aldrig",
        confirm_always: "Altid",
        confirm_from: "Fra {n} ad gangen",
        set_clearMarksRead: "Rydning af omtaler markerer også deres kanaler som læst",
        set_checkUpdates: "Søg efter opdateringer",
        note_checkUpdates: "Søger efter en ny version på GitHub og tilbyder at installere den med ét klik.",
        notice_update: "ReadAllNotificationsButtonv2 {version} er tilgængelig.",
        button_update: "Opdater",
        toast_updated: "Opdateret til {version}",
        toast_updateFailed: "Opdatering mislykkedes: {error}",
        set_buttonStyle: "Knappens stil",
        style_text: "Tekst",
        style_icon: "Ikon",
        style_both: "Ikon og tekst",
        set_readOnLeave: "Marker en server som læst, når du skifter til en anden",
        set_activeFrom: "Automatisk læsning fra",
        set_activeTo: "Automatisk læsning indtil",
        note_activeHours: "Gælder for intervallet, lydløse servere og opstart. Samme time eller \"Når som helst\" betyder altid.",
        hours_any: "Når som helst",
        set_clearHotkey: "Genvejstast til rydning af omtaler",
        context_clear_all: "Alle omtaler",
        context_clear_server: "Omtaler fra denne server",
        context_clear_old: "Omtaler ældre end en dag",
        settings_stats: "Statistik",
        stats_text: "Markeret som læst: {servers} servere, {dms} direkte beskeder · Omtaler ryddet: {mentions}",
        button_reset: "Nulstil",
        toast_noMentions: "Ingen matchende omtaler",
    },
    el: {
        context_unreadguilds: "Μη αναγνωσμένοι διακομιστές",
        context_pingedguilds: "Διακομιστές με αναφορές",
        context_mutedguilds: "Διακομιστές σε σίγαση",
        context_guilds: "Όλοι οι διακομιστές",
        context_dms: "Άμεσα μηνύματα",
        context_current: "Τρέχων διακομιστής",
        context_others: "Όλοι οι διακομιστές εκτός του τρέχοντος",
        context_folders: "Φάκελοι",
        context_alldms: "Όλα τα μη αναγνωσμένα άμεσα μηνύματα",
        modal_title: "Επιβεβαίωση",
        modal_confirmnotifications: "Θέλετε σίγουρα να επισημάνετε όλες τις μη αναγνωσμένες ειδοποιήσεις ως αναγνωσμένες;",
        modal_confirmmentions: "Θέλετε σίγουρα να αφαιρέσετε όλες τις αναφορές από τη λίστα;",
        tooltip_clear: "Κλείσιμο (όλα)",
        tooltip_button: "Μη αναγνωσμένα: διακομιστές {servers} · ΑΜ {dms}\nShift+κλικ επισημαίνει όλα ως αναγνωσμένα",
        toast_alreadyclearing: "Οι αναφορές αφαιρούνται ήδη, περιμένετε",
        toast_clearing: "Αφαίρεση αναφορών ({n}), διαρκεί περίπου {n} δευτ.",
        toast_cleared: "Όλες οι πρόσφατες αναφορές αφαιρέθηκαν",
        toast_read: "Επισημάνθηκαν ως αναγνωσμένα · Διακομιστές: {servers} · ΑΜ: {dms}",
        toast_nothing: "Δεν υπήρχε τίποτα μη αναγνωσμένο",
        settings_general: "Ρυθμίσεις",
        settings_batch: "Το αριστερό κλικ επισημαίνει ως αναγνωσμένα",
        settings_extras: "Επιπλέον",
        settings_blacklist: "Μαύρη λίστα διακομιστών",
        set_addClearButton: "Προσθέτει στο παράθυρο αναφορών κουμπί που τις αφαιρεί όλες",
        set_guilds: "Μη αναγνωσμένοι διακομιστές",
        set_muted: "Διακομιστές σε σίγαση",
        set_dms: "Άμεσα μηνύματα με αναφορές",
        set_label: "Κείμενο κουμπιού",
        set_hideWhenEmpty: "Κρύβει το κουμπί όσο δεν υπάρχει τίποτα μη αναγνωσμένο",
        set_toast: "Εμφανίζει πόσα επισημάνθηκαν ως αναγνωσμένα",
        set_autoMuted: "Επισημαίνει αυτόματα τους διακομιστές σε σίγαση ως αναγνωσμένους",
        note_autoMuted: "Τα νέα μηνύματα σε διακομιστές σε σίγαση επισημαίνονται ως αναγνωσμένα μετά από 5 δευτερόλεπτα. Ισχύει η μαύρη λίστα.",
        set_readOnStart: "Επισημαίνει όλα ως αναγνωσμένα κατά την εκκίνηση του Discord (όπως το αριστερό κλικ)",
        set_hotkey: "Συντόμευση πληκτρολογίου",
        note_hotkey: "Κάνει το ίδιο με ένα αριστερό κλικ στο κουμπί.",
        blacklist_note: "Οι γκρι διακομιστές δεν επισημαίνονται ποτέ ως αναγνωσμένοι. Κάντε κλικ σε έναν διακομιστή για εναλλαγή.",
        blacklist_enable: "Ενεργοποίηση για όλους τους διακομιστές",
        blacklist_disable: "Απενεργοποίηση για όλους τους διακομιστές",
        button_enable: "Ενεργοποίηση",
        button_disable: "Απενεργοποίηση",
        set_language: "Γλώσσα",
        note_language: "Ισχύει αμέσως. Ανοίξτε ξανά τις ρυθμίσεις για να τις δείτε στη νέα γλώσσα.",
        language_auto: "Αυτόματα (γλώσσα του Discord)",
        set_badgeMode: "Μετρητής στο κουμπί",
        badge_mentions: "Αναφορές",
        badge_unread: "Μη αναγνωσμένοι διακομιστές και ΑΜ",
        badge_off: "Ανενεργός",
        set_interval: "Αυτόματη επισήμανση ως αναγνωσμένα κάθε",
        interval_off: "Ποτέ",
        interval_minutes: "{n} λεπτά",
        context_blacklist: "Εξαίρεση από το read all",
        tooltip_middle: "Το μεσαίο κλικ επισημαίνει μόνο τον τρέχοντα διακομιστή ως αναγνωσμένο",
        set_olderThan: "Επισήμανση ως αναγνωσμένα μόνο μηνυμάτων παλαιότερων από",
        note_olderThan: "Τα νεότερα μηνύματα μένουν μη αναγνωσμένα. Τα κανάλια με αναφορές μένουν πάντα μη αναγνωσμένα σε αυτή τη λειτουργία.",
        olderThan_off: "Όλα τα μηνύματα",
        olderThan_hours: "{n} ώρ.",
        set_keepMentions: "Τα κανάλια με αναφορές μένουν μη αναγνωσμένα",
        channels_excluded: "Εξαιρεμένα κανάλια (δεξί κλικ σε κανάλι για προσθήκη)",
        channels_none: "Κανένα",
        button_clear: "Αφαίρεση όλων",
        tooltip_more: "+{n} ακόμη",
        set_confirm: "Ερώτηση πριν από σήμανση ή εκκαθάριση",
        confirm_never: "Ποτέ",
        confirm_always: "Πάντα",
        confirm_from: "Από {n} μαζί",
        set_clearMarksRead: "Η εκκαθάριση αναφορών επισημαίνει και τα κανάλια τους ως αναγνωσμένα",
        set_checkUpdates: "Έλεγχος για ενημερώσεις",
        note_checkUpdates: "Αναζητά νέα έκδοση στο GitHub και προτείνει εγκατάσταση με ένα κλικ.",
        notice_update: "Το ReadAllNotificationsButtonv2 {version} είναι διαθέσιμο.",
        button_update: "Ενημέρωση",
        toast_updated: "Ενημερώθηκε στην {version}",
        toast_updateFailed: "Η ενημέρωση απέτυχε: {error}",
        set_buttonStyle: "Στυλ κουμπιού",
        style_text: "Κείμενο",
        style_icon: "Εικονίδιο",
        style_both: "Εικονίδιο και κείμενο",
        set_readOnLeave: "Επισήμανση διακομιστή ως αναγνωσμένου όταν μεταβαίνετε σε άλλον",
        set_activeFrom: "Αυτόματη ανάγνωση από",
        set_activeTo: "Αυτόματη ανάγνωση έως",
        note_activeHours: "Ισχύει για το διάστημα, τους διακομιστές σε σίγαση και την εκκίνηση. Ίδια ώρα ή «Οποτεδήποτε» σημαίνει πάντα.",
        hours_any: "Οποτεδήποτε",
        set_clearHotkey: "Συντόμευση για εκκαθάριση αναφορών",
        context_clear_all: "Όλες οι αναφορές",
        context_clear_server: "Αναφορές από αυτόν τον διακομιστή",
        context_clear_old: "Αναφορές παλαιότερες από μία ημέρα",
        settings_stats: "Στατιστικά",
        stats_text: "Επισημάνθηκαν ως αναγνωσμένα: {servers} διακομιστές, {dms} άμεσα μηνύματα · Αναφορές που διαγράφηκαν: {mentions}",
        button_reset: "Επαναφορά",
        toast_noMentions: "Δεν υπάρχουν αντίστοιχες αναφορές",
    },
    es: {
        context_unreadguilds: "Servidores no leídos",
        context_pingedguilds: "Servidores con menciones",
        context_mutedguilds: "Servidores silenciados",
        context_guilds: "Todos los servidores",
        context_dms: "Mensajes directos",
        context_current: "Servidor actual",
        context_others: "Todos los servidores excepto el actual",
        context_folders: "Carpetas",
        context_alldms: "Todos los mensajes directos no leídos",
        modal_title: "Confirmar",
        modal_confirmnotifications: "¿Seguro que quieres marcar todas las notificaciones no leídas como leídas?",
        modal_confirmmentions: "¿Seguro que quieres quitar todas las menciones de la lista?",
        tooltip_clear: "Cerrar (todo)",
        tooltip_button: "No leídos: {servers} servidores · {dms} MD\nMayús+clic marca todo como leído",
        toast_alreadyclearing: "Ya se están quitando menciones, espera",
        toast_clearing: "Quitando {n} menciones, tarda unos {n} segundos",
        toast_cleared: "Se han quitado todas las menciones recientes",
        toast_read: "Marcado como leído · Servidores: {servers} · MD: {dms}",
        toast_nothing: "No había nada sin leer",
        settings_general: "Ajustes",
        settings_batch: "El clic izquierdo marca como leído",
        settings_extras: "Extras",
        settings_blacklist: "Lista negra de servidores",
        set_addClearButton: "Añade un botón a la ventana de menciones que las quita todas",
        set_guilds: "Servidores no leídos",
        set_muted: "Servidores silenciados",
        set_dms: "Mensajes directos con menciones",
        set_label: "Texto del botón",
        set_hideWhenEmpty: "Oculta el botón mientras no haya nada sin leer",
        set_toast: "Muestra cuánto se marcó como leído",
        set_autoMuted: "Marca automáticamente los servidores silenciados como leídos",
        note_autoMuted: "Los mensajes nuevos en servidores silenciados se marcan como leídos tras 5 segundos. Se aplica la lista negra.",
        set_readOnStart: "Marca todo como leído al iniciar Discord (según el clic izquierdo)",
        set_hotkey: "Atajo de teclado",
        note_hotkey: "Hace lo mismo que un clic izquierdo en el botón.",
        blacklist_note: "Los servidores en gris nunca se marcan como leídos. Haz clic en un servidor para cambiarlo.",
        blacklist_enable: "Activar para todos los servidores",
        blacklist_disable: "Desactivar para todos los servidores",
        button_enable: "Activar",
        button_disable: "Desactivar",
        set_language: "Idioma",
        note_language: "Se aplica al instante. Vuelve a abrir los ajustes para verlos en el nuevo idioma.",
        language_auto: "Automático (idioma de Discord)",
        set_badgeMode: "Contador en el botón",
        badge_mentions: "Menciones",
        badge_unread: "Servidores y MD no leídos",
        badge_off: "Desactivado",
        set_interval: "Marcar como leído automáticamente cada",
        interval_off: "Nunca",
        interval_minutes: "{n} minutos",
        context_blacklist: "Excluir de read all",
        tooltip_middle: "El clic central marca como leído solo el servidor actual",
        set_olderThan: "Marcar como leídos solo los mensajes más antiguos de",
        note_olderThan: "Los mensajes más nuevos siguen sin leer. En este modo, los canales con menciones siempre quedan sin leer.",
        olderThan_off: "Todos los mensajes",
        olderThan_hours: "{n} h",
        set_keepMentions: "Dejar sin leer los canales con menciones",
        channels_excluded: "Canales excluidos (clic derecho en un canal para añadirlo)",
        channels_none: "Ninguno",
        button_clear: "Quitar todos",
        tooltip_more: "+{n} más",
        set_confirm: "Preguntar antes de marcar o borrar",
        confirm_never: "Nunca",
        confirm_always: "Siempre",
        confirm_from: "A partir de {n} a la vez",
        set_clearMarksRead: "Borrar menciones también marca sus canales como leídos",
        set_checkUpdates: "Buscar actualizaciones",
        note_checkUpdates: "Busca una nueva versión en GitHub y ofrece instalarla con un clic.",
        notice_update: "ReadAllNotificationsButtonv2 {version} está disponible.",
        button_update: "Actualizar",
        toast_updated: "Actualizado a {version}",
        toast_updateFailed: "Error al actualizar: {error}",
        set_buttonStyle: "Estilo del botón",
        style_text: "Texto",
        style_icon: "Icono",
        style_both: "Icono y texto",
        set_readOnLeave: "Marcar un servidor como leído al cambiar a otro",
        set_activeFrom: "Lectura automática desde",
        set_activeTo: "Lectura automática hasta",
        note_activeHours: "Se aplica al intervalo, a los servidores silenciados y al inicio. La misma hora o «Cualquier hora» significa siempre.",
        hours_any: "Cualquier hora",
        set_clearHotkey: "Atajo para borrar menciones",
        context_clear_all: "Todas las menciones",
        context_clear_server: "Menciones de este servidor",
        context_clear_old: "Menciones de hace más de un día",
        settings_stats: "Estadísticas",
        stats_text: "Marcados como leídos: {servers} servidores, {dms} mensajes directos · Menciones borradas: {mentions}",
        button_reset: "Restablecer",
        toast_noMentions: "No hay menciones que coincidan",
    },
    fi: {
        context_unreadguilds: "Lukemattomat palvelimet",
        context_pingedguilds: "Palvelimet, joissa mainintoja",
        context_mutedguilds: "Mykistetyt palvelimet",
        context_guilds: "Kaikki palvelimet",
        context_dms: "Yksityisviestit",
        context_current: "Nykyinen palvelin",
        context_others: "Kaikki palvelimet paitsi nykyinen",
        context_folders: "Kansiot",
        context_alldms: "Kaikki lukemattomat yksityisviestit",
        modal_title: "Vahvista",
        modal_confirmnotifications: "Haluatko varmasti merkitä kaikki lukemattomat ilmoitukset luetuiksi?",
        modal_confirmmentions: "Haluatko varmasti poistaa kaikki maininnat listasta?",
        tooltip_clear: "Sulje (kaikki)",
        tooltip_button: "Lukematta: palvelimet {servers} · YV {dms}\nVaihto+napsautus merkitsee kaiken luetuksi",
        toast_alreadyclearing: "Mainintoja poistetaan jo, odota",
        toast_clearing: "Poistetaan mainintoja ({n}), kestää noin {n} s",
        toast_cleared: "Kaikki viimeaikaiset maininnat on poistettu",
        toast_read: "Merkitty luetuksi · Palvelimet: {servers} · YV: {dms}",
        toast_nothing: "Mitään lukematonta ei ollut",
        settings_general: "Asetukset",
        settings_batch: "Vasen napsautus merkitsee luetuksi",
        settings_extras: "Lisätoiminnot",
        settings_blacklist: "Palvelimien estolista",
        set_addClearButton: "Lisää mainintaikkunaan painikkeen, joka poistaa kaikki maininnat",
        set_guilds: "Lukemattomat palvelimet",
        set_muted: "Mykistetyt palvelimet",
        set_dms: "Yksityisviestit, joissa mainintoja",
        set_label: "Painikkeen teksti",
        set_hideWhenEmpty: "Piilottaa painikkeen, kun mitään ei ole lukematta",
        set_toast: "Näyttää, kuinka paljon merkittiin luetuksi",
        set_autoMuted: "Merkitsee mykistetyt palvelimet automaattisesti luetuiksi",
        note_autoMuted: "Uudet viestit mykistetyillä palvelimilla merkitään luetuiksi 5 sekunnin kuluttua. Estolista on voimassa.",
        set_readOnStart: "Merkitsee kaiken luetuksi, kun Discord käynnistyy (kuten vasen napsautus)",
        set_hotkey: "Pikanäppäin",
        note_hotkey: "Tekee saman kuin vasen napsautus painikkeeseen.",
        blacklist_note: "Harmaita palvelimia ei koskaan merkitä luetuiksi. Vaihda napsauttamalla palvelinta.",
        blacklist_enable: "Ota käyttöön kaikilla palvelimilla",
        blacklist_disable: "Poista käytöstä kaikilla palvelimilla",
        button_enable: "Ota käyttöön",
        button_disable: "Poista käytöstä",
        set_language: "Kieli",
        note_language: "Tulee voimaan heti. Avaa asetukset uudelleen nähdäksesi ne uudella kielellä.",
        language_auto: "Automaattinen (Discordin kieli)",
        set_badgeMode: "Laskuri painikkeessa",
        badge_mentions: "Maininnat",
        badge_unread: "Lukemattomat palvelimet ja YV:t",
        badge_off: "Pois",
        set_interval: "Merkitse automaattisesti luetuksi joka",
        interval_off: "Ei koskaan",
        interval_minutes: "{n} minuutti",
        context_blacklist: "Jätä pois read all -toiminnosta",
        tooltip_middle: "Keskinapsautus merkitsee vain nykyisen palvelimen luetuksi",
        set_olderThan: "Merkitse luetuiksi vain viestit, jotka ovat vanhempia kuin",
        note_olderThan: "Uudemmat viestit jäävät lukemattomiksi. Kanavat, joissa on mainintoja, jäävät tässä tilassa aina lukemattomiksi.",
        olderThan_off: "Kaikki viestit",
        olderThan_hours: "{n} t",
        set_keepMentions: "Jätä kanavat, joissa on mainintoja, lukemattomiksi",
        channels_excluded: "Pois jätetyt kanavat (lisää napsauttamalla kanavaa hiiren oikealla)",
        channels_none: "Ei yhtään",
        button_clear: "Poista kaikki",
        tooltip_more: "+{n} muuta",
        set_confirm: "Kysy ennen merkitsemistä tai tyhjentämistä",
        confirm_never: "Ei koskaan",
        confirm_always: "Aina",
        confirm_from: "Kun kerralla {n} tai enemmän",
        set_clearMarksRead: "Mainintojen tyhjentäminen merkitsee myös niiden kanavat luetuiksi",
        set_checkUpdates: "Tarkista päivitykset",
        note_checkUpdates: "Etsii uutta versiota GitHubista ja tarjoaa asennusta yhdellä napsautuksella.",
        notice_update: "ReadAllNotificationsButtonv2 {version} on saatavilla.",
        button_update: "Päivitä",
        toast_updated: "Päivitetty versioon {version}",
        toast_updateFailed: "Päivitys epäonnistui: {error}",
        set_buttonStyle: "Painikkeen tyyli",
        style_text: "Teksti",
        style_icon: "Kuvake",
        style_both: "Kuvake ja teksti",
        set_readOnLeave: "Merkitse palvelin luetuksi, kun siirryt toiselle",
        set_activeFrom: "Automaattinen lukeminen alkaa",
        set_activeTo: "Automaattinen lukeminen päättyy",
        note_activeHours: "Koskee aikaväliä, mykistettyjä palvelimia ja käynnistystä. Sama tunti tai \"Milloin tahansa\" tarkoittaa aina.",
        hours_any: "Milloin tahansa",
        set_clearHotkey: "Pikanäppäin mainintojen tyhjentämiseen",
        context_clear_all: "Kaikki maininnat",
        context_clear_server: "Maininnat tältä palvelimelta",
        context_clear_old: "Yli päivän vanhat maininnat",
        settings_stats: "Tilastot",
        stats_text: "Merkitty luetuksi: {servers} palvelinta, {dms} yksityisviestiä · Tyhjennetyt maininnat: {mentions}",
        button_reset: "Nollaa",
        toast_noMentions: "Ei sopivia mainintoja",
    },
    fr: {
        context_unreadguilds: "Serveurs non lus",
        context_pingedguilds: "Serveurs avec mentions",
        context_mutedguilds: "Serveurs en sourdine",
        context_guilds: "Tous les serveurs",
        context_dms: "Messages privés",
        context_current: "Serveur actuel",
        context_others: "Tous les serveurs sauf l'actuel",
        context_folders: "Dossiers",
        context_alldms: "Tous les messages privés non lus",
        modal_title: "Confirmer",
        modal_confirmnotifications: "Voulez-vous vraiment marquer toutes les notifications non lues comme lues ?",
        modal_confirmmentions: "Voulez-vous vraiment retirer toutes les mentions de la liste ?",
        tooltip_clear: "Fermer (tout)",
        tooltip_button: "Non lus : {servers} serveurs · {dms} MP\nMaj+clic marque tout comme lu",
        toast_alreadyclearing: "Des mentions sont déjà en cours de suppression, veuillez patienter",
        toast_clearing: "Suppression de {n} mentions, cela prend environ {n} secondes",
        toast_cleared: "Toutes les mentions récentes ont été supprimées",
        toast_read: "Marqué comme lu · Serveurs : {servers} · MP : {dms}",
        toast_nothing: "Rien n'était non lu",
        settings_general: "Paramètres",
        settings_batch: "Le clic gauche marque comme lu",
        settings_extras: "Extras",
        settings_blacklist: "Liste noire des serveurs",
        set_addClearButton: "Ajoute un bouton dans la fenêtre des mentions pour toutes les supprimer",
        set_guilds: "Serveurs non lus",
        set_muted: "Serveurs en sourdine",
        set_dms: "Messages privés avec mentions",
        set_label: "Texte du bouton",
        set_hideWhenEmpty: "Masque le bouton tant que rien n'est non lu",
        set_toast: "Affiche ce qui a été marqué comme lu",
        set_autoMuted: "Marque automatiquement les serveurs en sourdine comme lus",
        note_autoMuted: "Les nouveaux messages dans les serveurs en sourdine sont marqués comme lus après 5 secondes. La liste noire s'applique.",
        set_readOnStart: "Marque tout comme lu au démarrage de Discord (selon le clic gauche)",
        set_hotkey: "Raccourci clavier",
        note_hotkey: "Fait la même chose qu'un clic gauche sur le bouton.",
        blacklist_note: "Les serveurs grisés ne sont jamais marqués comme lus. Cliquez sur un serveur pour basculer.",
        blacklist_enable: "Activer pour tous les serveurs",
        blacklist_disable: "Désactiver pour tous les serveurs",
        button_enable: "Activer",
        button_disable: "Désactiver",
        set_language: "Langue",
        note_language: "S'applique tout de suite. Rouvrez les paramètres pour les voir dans la nouvelle langue.",
        language_auto: "Automatique (langue de Discord)",
        set_badgeMode: "Compteur sur le bouton",
        badge_mentions: "Mentions",
        badge_unread: "Serveurs et MP non lus",
        badge_off: "Désactivé",
        set_interval: "Marquer comme lu automatiquement toutes les",
        interval_off: "Jamais",
        interval_minutes: "{n} minutes",
        context_blacklist: "Exclure de read all",
        tooltip_middle: "Le clic du milieu marque uniquement le serveur actuel comme lu",
        set_olderThan: "Marquer comme lus uniquement les messages plus anciens que",
        note_olderThan: "Les messages plus récents restent non lus. Dans ce mode, les salons avec mentions restent toujours non lus.",
        olderThan_off: "Tous les messages",
        olderThan_hours: "{n} h",
        set_keepMentions: "Laisser non lus les salons avec mentions",
        channels_excluded: "Salons exclus (clic droit sur un salon pour l'ajouter)",
        channels_none: "Aucun",
        button_clear: "Tout retirer",
        tooltip_more: "+{n} autres",
        set_confirm: "Demander avant de marquer ou d'effacer",
        confirm_never: "Jamais",
        confirm_always: "Toujours",
        confirm_from: "À partir de {n} à la fois",
        set_clearMarksRead: "Effacer les mentions marque aussi leurs salons comme lus",
        set_checkUpdates: "Rechercher des mises à jour",
        note_checkUpdates: "Cherche une nouvelle version sur GitHub et propose de l'installer en un clic.",
        notice_update: "ReadAllNotificationsButtonv2 {version} est disponible.",
        button_update: "Mettre à jour",
        toast_updated: "Mis à jour vers {version}",
        toast_updateFailed: "Échec de la mise à jour : {error}",
        set_buttonStyle: "Style du bouton",
        style_text: "Texte",
        style_icon: "Icône",
        style_both: "Icône et texte",
        set_readOnLeave: "Marquer un serveur comme lu quand vous passez à un autre",
        set_activeFrom: "Lecture automatique à partir de",
        set_activeTo: "Lecture automatique jusqu'à",
        note_activeHours: "S'applique à l'intervalle, aux serveurs en sourdine et au démarrage. La même heure ou « N'importe quand » signifie toujours.",
        hours_any: "N'importe quand",
        set_clearHotkey: "Raccourci pour effacer les mentions",
        context_clear_all: "Toutes les mentions",
        context_clear_server: "Mentions de ce serveur",
        context_clear_old: "Mentions de plus d'un jour",
        settings_stats: "Statistiques",
        stats_text: "Marqués comme lus : {servers} serveurs, {dms} messages privés · Mentions effacées : {mentions}",
        button_reset: "Réinitialiser",
        toast_noMentions: "Aucune mention correspondante",
    },
    hi: {
        context_unreadguilds: "अपठित सर्वर",
        context_pingedguilds: "उल्लेख वाले सर्वर",
        context_mutedguilds: "म्यूट किए गए सर्वर",
        context_guilds: "सभी सर्वर",
        context_dms: "डायरेक्ट मैसेज",
        context_current: "मौजूदा सर्वर",
        context_others: "मौजूदा सर्वर को छोड़कर सभी सर्वर",
        context_folders: "फ़ोल्डर",
        context_alldms: "सभी अपठित डायरेक्ट मैसेज",
        modal_title: "पुष्टि करें",
        modal_confirmnotifications: "क्या आप सच में सभी अपठित सूचनाओं को पढ़ा हुआ चिह्नित करना चाहते हैं?",
        modal_confirmmentions: "क्या आप सच में सूची से सभी उल्लेख हटाना चाहते हैं?",
        tooltip_clear: "बंद करें (सभी)",
        tooltip_button: "अपठित: सर्वर {servers} · DM {dms}\nShift+क्लिक सब कुछ पढ़ा हुआ चिह्नित करता है",
        toast_alreadyclearing: "उल्लेख पहले से हटाए जा रहे हैं, कृपया प्रतीक्षा करें",
        toast_clearing: "उल्लेख हटाए जा रहे हैं ({n}), लगभग {n} सेकंड लगेंगे",
        toast_cleared: "सभी हाल के उल्लेख हटा दिए गए",
        toast_read: "पढ़ा हुआ चिह्नित · सर्वर: {servers} · DM: {dms}",
        toast_nothing: "कुछ भी अपठित नहीं था",
        settings_general: "सेटिंग्स",
        settings_batch: "बायाँ क्लिक इन्हें पढ़ा हुआ चिह्नित करता है",
        settings_extras: "अतिरिक्त",
        settings_blacklist: "सर्वर ब्लैकलिस्ट",
        set_addClearButton: "उल्लेख विंडो में सभी उल्लेख हटाने वाला बटन जोड़ता है",
        set_guilds: "अपठित सर्वर",
        set_muted: "म्यूट किए गए सर्वर",
        set_dms: "उल्लेख वाले डायरेक्ट मैसेज",
        set_label: "बटन का टेक्स्ट",
        set_hideWhenEmpty: "जब तक कुछ अपठित न हो, बटन छिपाता है",
        set_toast: "दिखाता है कि कितना पढ़ा हुआ चिह्नित हुआ",
        set_autoMuted: "म्यूट किए गए सर्वरों को अपने आप पढ़ा हुआ चिह्नित करता है",
        note_autoMuted: "म्यूट किए गए सर्वरों के नए मैसेज 5 सेकंड बाद पढ़े हुए चिह्नित होते हैं। ब्लैकलिस्ट लागू होती है।",
        set_readOnStart: "Discord शुरू होने पर सब कुछ पढ़ा हुआ चिह्नित करता है (बाएँ क्लिक की तरह)",
        set_hotkey: "कीबोर्ड शॉर्टकट",
        note_hotkey: "बटन पर बाएँ क्लिक जैसा ही काम करता है।",
        blacklist_note: "धूसर सर्वर कभी पढ़े हुए चिह्नित नहीं होते। बदलने के लिए किसी सर्वर पर क्लिक करें।",
        blacklist_enable: "सभी सर्वरों के लिए चालू करें",
        blacklist_disable: "सभी सर्वरों के लिए बंद करें",
        button_enable: "चालू करें",
        button_disable: "बंद करें",
        set_language: "भाषा",
        note_language: "तुरंत लागू होती है। नई भाषा में देखने के लिए सेटिंग्स दोबारा खोलें।",
        language_auto: "अपने आप (Discord की भाषा)",
        set_badgeMode: "बटन पर गिनती",
        badge_mentions: "उल्लेख",
        badge_unread: "अपठित सर्वर और DM",
        badge_off: "बंद",
        set_interval: "अपने आप पढ़ा हुआ चिह्नित करें हर",
        interval_off: "कभी नहीं",
        interval_minutes: "{n} मिनट",
        context_blacklist: "read all से बाहर रखें",
        tooltip_middle: "मिडल क्लिक केवल मौजूदा सर्वर को पढ़ा हुआ चिह्नित करता है",
        set_olderThan: "केवल इससे पुराने मैसेज को पढ़ा हुआ चिह्नित करें",
        note_olderThan: "नए मैसेज अपठित रहते हैं। इस मोड में उल्लेख वाले चैनल हमेशा अपठित रहते हैं।",
        olderThan_off: "सभी मैसेज",
        olderThan_hours: "{n} घंटे",
        set_keepMentions: "उल्लेख वाले चैनल अपठित रहने दें",
        channels_excluded: "बाहर रखे गए चैनल (जोड़ने के लिए चैनल पर राइट क्लिक करें)",
        channels_none: "कोई नहीं",
        button_clear: "सभी हटाएँ",
        tooltip_more: "+{n} और",
        set_confirm: "चिह्नित करने या हटाने से पहले पूछें",
        confirm_never: "कभी नहीं",
        confirm_always: "हमेशा",
        confirm_from: "एक साथ {n} या अधिक होने पर",
        set_clearMarksRead: "उल्लेख हटाने पर उनके चैनल भी पढ़े हुए चिह्नित होते हैं",
        set_checkUpdates: "अपडेट की जाँच करें",
        note_checkUpdates: "GitHub पर नया संस्करण खोजता है और एक क्लिक में इंस्टॉल करने का विकल्प देता है।",
        notice_update: "ReadAllNotificationsButtonv2 {version} उपलब्ध है।",
        button_update: "अपडेट करें",
        toast_updated: "{version} पर अपडेट हो गया",
        toast_updateFailed: "अपडेट विफल: {error}",
        set_buttonStyle: "बटन की शैली",
        style_text: "टेक्स्ट",
        style_icon: "आइकन",
        style_both: "आइकन और टेक्स्ट",
        set_readOnLeave: "दूसरे सर्वर पर जाने पर सर्वर को पढ़ा हुआ चिह्नित करें",
        set_activeFrom: "स्वचालित पढ़ना शुरू",
        set_activeTo: "स्वचालित पढ़ना समाप्त",
        note_activeHours: "अंतराल, म्यूट किए गए सर्वर और शुरुआत पर लागू होता है। एक ही घंटा या \"किसी भी समय\" का अर्थ है हमेशा।",
        hours_any: "किसी भी समय",
        set_clearHotkey: "उल्लेख हटाने का शॉर्टकट",
        context_clear_all: "सभी उल्लेख",
        context_clear_server: "इस सर्वर के उल्लेख",
        context_clear_old: "एक दिन से पुराने उल्लेख",
        settings_stats: "आँकड़े",
        stats_text: "पढ़ा हुआ चिह्नित: {servers} सर्वर, {dms} डायरेक्ट मैसेज · हटाए गए उल्लेख: {mentions}",
        button_reset: "रीसेट करें",
        toast_noMentions: "कोई मिलता-जुलता उल्लेख नहीं",
    },
    hr: {
        context_unreadguilds: "Nepročitani poslužitelji",
        context_pingedguilds: "Poslužitelji sa spominjanjima",
        context_mutedguilds: "Utišani poslužitelji",
        context_guilds: "Svi poslužitelji",
        context_dms: "Izravne poruke",
        context_current: "Trenutačni poslužitelj",
        context_others: "Svi poslužitelji osim trenutačnog",
        context_folders: "Mape",
        context_alldms: "Sve nepročitane izravne poruke",
        modal_title: "Potvrdi",
        modal_confirmnotifications: "Želiš li stvarno označiti sve nepročitane obavijesti kao pročitane?",
        modal_confirmmentions: "Želiš li stvarno ukloniti sva spominjanja s popisa?",
        tooltip_clear: "Zatvori (sve)",
        tooltip_button: "Nepročitano: poslužitelji {servers} · IP {dms}\nShift+klik označava sve kao pročitano",
        toast_alreadyclearing: "Spominjanja se već uklanjaju, pričekaj",
        toast_clearing: "Uklanjanje spominjanja ({n}), traje oko {n} s",
        toast_cleared: "Sva nedavna spominjanja su uklonjena",
        toast_read: "Označeno kao pročitano · Poslužitelji: {servers} · IP: {dms}",
        toast_nothing: "Ništa nije bilo nepročitano",
        settings_general: "Postavke",
        settings_batch: "Lijevi klik označava kao pročitano",
        settings_extras: "Dodaci",
        settings_blacklist: "Crna lista poslužitelja",
        set_addClearButton: "Dodaje u prozor spominjanja gumb koji uklanja sva spominjanja",
        set_guilds: "Nepročitani poslužitelji",
        set_muted: "Utišani poslužitelji",
        set_dms: "Izravne poruke sa spominjanjima",
        set_label: "Tekst gumba",
        set_hideWhenEmpty: "Skriva gumb dok ništa nije nepročitano",
        set_toast: "Prikazuje koliko je označeno kao pročitano",
        set_autoMuted: "Automatski označava utišane poslužitelje kao pročitane",
        note_autoMuted: "Nove poruke na utišanim poslužiteljima označavaju se kao pročitane nakon 5 sekundi. Vrijedi crna lista.",
        set_readOnStart: "Označava sve kao pročitano pri pokretanju Discorda (kao lijevi klik)",
        set_hotkey: "Prečac tipkovnice",
        note_hotkey: "Radi isto što i lijevi klik na gumb.",
        blacklist_note: "Sivi poslužitelji nikad se ne označavaju kao pročitani. Klikni poslužitelj za promjenu.",
        blacklist_enable: "Uključi za sve poslužitelje",
        blacklist_disable: "Isključi za sve poslužitelje",
        button_enable: "Uključi",
        button_disable: "Isključi",
        set_language: "Jezik",
        note_language: "Vrijedi odmah. Ponovno otvori postavke da ih vidiš na novom jeziku.",
        language_auto: "Automatski (jezik Discorda)",
        set_badgeMode: "Brojač na gumbu",
        badge_mentions: "Spominjanja",
        badge_unread: "Nepročitani poslužitelji i IP",
        badge_off: "Isključeno",
        set_interval: "Automatski označi kao pročitano svakih",
        interval_off: "Nikad",
        interval_minutes: "{n} minuta",
        context_blacklist: "Izuzmi iz read all",
        tooltip_middle: "Srednji klik označava samo trenutačni poslužitelj kao pročitan",
        set_olderThan: "Označi kao pročitane samo poruke starije od",
        note_olderThan: "Novije poruke ostaju nepročitane. Kanali sa spominjanjima u ovom načinu uvijek ostaju nepročitani.",
        olderThan_off: "Sve poruke",
        olderThan_hours: "{n} h",
        set_keepMentions: "Kanale sa spominjanjima ostavi nepročitanima",
        channels_excluded: "Izuzeti kanali (desni klik na kanal za dodavanje)",
        channels_none: "Nema",
        button_clear: "Ukloni sve",
        tooltip_more: "+{n} više",
        set_confirm: "Pitaj prije označavanja ili brisanja",
        confirm_never: "Nikad",
        confirm_always: "Uvijek",
        confirm_from: "Od {n} odjednom",
        set_clearMarksRead: "Brisanje spominjanja označava i njihove kanale kao pročitane",
        set_checkUpdates: "Provjeravaj ažuriranja",
        note_checkUpdates: "Traži novu verziju na GitHubu i nudi instalaciju jednim klikom.",
        notice_update: "ReadAllNotificationsButtonv2 {version} je dostupan.",
        button_update: "Ažuriraj",
        toast_updated: "Ažurirano na {version}",
        toast_updateFailed: "Ažuriranje nije uspjelo: {error}",
        set_buttonStyle: "Stil gumba",
        style_text: "Tekst",
        style_icon: "Ikona",
        style_both: "Ikona i tekst",
        set_readOnLeave: "Označi poslužitelj kao pročitan kad prijeđeš na drugi",
        set_activeFrom: "Automatsko čitanje od",
        set_activeTo: "Automatsko čitanje do",
        note_activeHours: "Vrijedi za interval, utišane poslužitelje i pokretanje. Isti sat ili „Bilo kada” znači uvijek.",
        hours_any: "Bilo kada",
        set_clearHotkey: "Prečac za brisanje spominjanja",
        context_clear_all: "Sva spominjanja",
        context_clear_server: "Spominjanja s ovog poslužitelja",
        context_clear_old: "Spominjanja starija od jednog dana",
        settings_stats: "Statistika",
        stats_text: "Označeno kao pročitano: poslužitelja {servers}, izravnih poruka {dms} · Obrisano spominjanja: {mentions}",
        button_reset: "Poništi",
        toast_noMentions: "Nema odgovarajućih spominjanja",
    },
    hu: {
        context_unreadguilds: "Olvasatlan szerverek",
        context_pingedguilds: "Említéses szerverek",
        context_mutedguilds: "Némított szerverek",
        context_guilds: "Összes szerver",
        context_dms: "Közvetlen üzenetek",
        context_current: "Jelenlegi szerver",
        context_others: "Összes szerver a jelenlegi kivételével",
        context_folders: "Mappák",
        context_alldms: "Összes olvasatlan közvetlen üzenet",
        modal_title: "Megerősítés",
        modal_confirmnotifications: "Biztosan olvasottnak jelölöd az összes olvasatlan értesítést?",
        modal_confirmmentions: "Biztosan eltávolítod az összes említést a listából?",
        tooltip_clear: "Bezárás (összes)",
        tooltip_button: "Olvasatlan: szerverek {servers} · DM {dms}\nShift+kattintás mindent olvasottnak jelöl",
        toast_alreadyclearing: "Az említések eltávolítása már folyamatban van, várj",
        toast_clearing: "Említések eltávolítása ({n}), kb. {n} másodpercig tart",
        toast_cleared: "Az összes friss említés eltávolítva",
        toast_read: "Olvasottnak jelölve · Szerverek: {servers} · DM: {dms}",
        toast_nothing: "Nem volt olvasatlan",
        settings_general: "Beállítások",
        settings_batch: "A bal kattintás olvasottnak jelöli",
        settings_extras: "Extrák",
        settings_blacklist: "Szerverek tiltólistája",
        set_addClearButton: "Gombot ad az említések ablakhoz, amely minden említést eltávolít",
        set_guilds: "Olvasatlan szerverek",
        set_muted: "Némított szerverek",
        set_dms: "Közvetlen üzenetek említéssel",
        set_label: "Gomb szövege",
        set_hideWhenEmpty: "Elrejti a gombot, amíg nincs olvasatlan",
        set_toast: "Megmutatja, mennyi lett olvasottnak jelölve",
        set_autoMuted: "A némított szervereket automatikusan olvasottnak jelöli",
        note_autoMuted: "A némított szerverek új üzenetei 5 másodperc után olvasottnak lesznek jelölve. A tiltólista érvényes.",
        set_readOnStart: "A Discord indításakor mindent olvasottnak jelöl (mint a bal kattintás)",
        set_hotkey: "Billentyűparancs",
        note_hotkey: "Ugyanazt teszi, mint a bal kattintás a gombra.",
        blacklist_note: "A szürke szerverek soha nem lesznek olvasottnak jelölve. Kattints egy szerverre a váltáshoz.",
        blacklist_enable: "Bekapcsolás minden szerveren",
        blacklist_disable: "Kikapcsolás minden szerveren",
        button_enable: "Bekapcsolás",
        button_disable: "Kikapcsolás",
        set_language: "Nyelv",
        note_language: "Azonnal érvényes. Nyisd meg újra a beállításokat, hogy az új nyelven lásd őket.",
        language_auto: "Automatikus (a Discord nyelve)",
        set_badgeMode: "Számláló a gombon",
        badge_mentions: "Említések",
        badge_unread: "Olvasatlan szerverek és DM-ek",
        badge_off: "Ki",
        set_interval: "Automatikus olvasottnak jelölés ennyi időnként:",
        interval_off: "Soha",
        interval_minutes: "{n} perc",
        context_blacklist: "Kizárás a read all alól",
        tooltip_middle: "A középső kattintás csak a jelenlegi szervert jelöli olvasottnak",
        set_olderThan: "Csak az ennél régebbi üzenetek olvasottnak jelölése:",
        note_olderThan: "Az újabb üzenetek olvasatlanok maradnak. Ebben a módban az említéses csatornák mindig olvasatlanok maradnak.",
        olderThan_off: "Minden üzenet",
        olderThan_hours: "{n} óra",
        set_keepMentions: "Az említéses csatornák maradjanak olvasatlanok",
        channels_excluded: "Kizárt csatornák (jobb kattintás egy csatornára a hozzáadáshoz)",
        channels_none: "Nincs",
        button_clear: "Összes eltávolítása",
        tooltip_more: "+{n} további",
        set_confirm: "Kérdezzen jelölés vagy törlés előtt",
        confirm_never: "Soha",
        confirm_always: "Mindig",
        confirm_from: "Egyszerre {n} vagy több esetén",
        set_clearMarksRead: "Az említések törlése a csatornáikat is olvasottnak jelöli",
        set_checkUpdates: "Frissítések keresése",
        note_checkUpdates: "Új verziót keres a GitHubon, és felajánlja a telepítését egy kattintással.",
        notice_update: "Elérhető a ReadAllNotificationsButtonv2 {version}.",
        button_update: "Frissítés",
        toast_updated: "Frissítve erre: {version}",
        toast_updateFailed: "A frissítés sikertelen: {error}",
        set_buttonStyle: "Gomb stílusa",
        style_text: "Szöveg",
        style_icon: "Ikon",
        style_both: "Ikon és szöveg",
        set_readOnLeave: "Szerver olvasottnak jelölése, amikor másikra váltasz",
        set_activeFrom: "Automatikus olvasás ettől",
        set_activeTo: "Automatikus olvasás eddig",
        note_activeHours: "Az időközre, a némított szerverekre és az indításra vonatkozik. Azonos óra vagy „Bármikor” azt jelenti: mindig.",
        hours_any: "Bármikor",
        set_clearHotkey: "Billentyűparancs az említések törléséhez",
        context_clear_all: "Összes említés",
        context_clear_server: "Említések erről a szerverről",
        context_clear_old: "Egy napnál régebbi említések",
        settings_stats: "Statisztika",
        stats_text: "Olvasottnak jelölve: {servers} szerver, {dms} közvetlen üzenet · Törölt említések: {mentions}",
        button_reset: "Visszaállítás",
        toast_noMentions: "Nincs megfelelő említés",
    },
    id: {
        context_unreadguilds: "Server belum dibaca",
        context_pingedguilds: "Server dengan sebutan",
        context_mutedguilds: "Server yang dibisukan",
        context_guilds: "Semua server",
        context_dms: "Pesan langsung",
        context_current: "Server saat ini",
        context_others: "Semua server kecuali yang saat ini",
        context_folders: "Folder",
        context_alldms: "Semua pesan langsung yang belum dibaca",
        modal_title: "Konfirmasi",
        modal_confirmnotifications: "Yakin ingin menandai semua notifikasi yang belum dibaca sebagai sudah dibaca?",
        modal_confirmmentions: "Yakin ingin menghapus semua sebutan dari daftar?",
        tooltip_clear: "Tutup (semua)",
        tooltip_button: "Belum dibaca: server {servers} · DM {dms}\nShift+klik menandai semuanya sudah dibaca",
        toast_alreadyclearing: "Sebutan sedang dihapus, harap tunggu",
        toast_clearing: "Menghapus sebutan ({n}), butuh sekitar {n} detik",
        toast_cleared: "Semua sebutan terbaru telah dihapus",
        toast_read: "Ditandai sudah dibaca · Server: {servers} · DM: {dms}",
        toast_nothing: "Tidak ada yang belum dibaca",
        settings_general: "Pengaturan",
        settings_batch: "Klik kiri menandai yang berikut sebagai sudah dibaca",
        settings_extras: "Tambahan",
        settings_blacklist: "Daftar hitam server",
        set_addClearButton: "Menambahkan tombol di jendela sebutan untuk menghapus semua sebutan",
        set_guilds: "Server belum dibaca",
        set_muted: "Server yang dibisukan",
        set_dms: "Pesan langsung dengan sebutan",
        set_label: "Teks tombol",
        set_hideWhenEmpty: "Menyembunyikan tombol selama tidak ada yang belum dibaca",
        set_toast: "Menampilkan berapa yang ditandai sudah dibaca",
        set_autoMuted: "Otomatis menandai server yang dibisukan sebagai sudah dibaca",
        note_autoMuted: "Pesan baru di server yang dibisukan ditandai sudah dibaca setelah 5 detik. Daftar hitam berlaku.",
        set_readOnStart: "Menandai semuanya sudah dibaca saat Discord dimulai (seperti klik kiri)",
        set_hotkey: "Pintasan keyboard",
        note_hotkey: "Sama seperti klik kiri pada tombol.",
        blacklist_note: "Server abu-abu tidak pernah ditandai sudah dibaca. Klik server untuk mengubah.",
        blacklist_enable: "Aktifkan untuk semua server",
        blacklist_disable: "Nonaktifkan untuk semua server",
        button_enable: "Aktifkan",
        button_disable: "Nonaktifkan",
        set_language: "Bahasa",
        note_language: "Berlaku langsung. Buka ulang pengaturan untuk melihatnya dalam bahasa baru.",
        language_auto: "Otomatis (bahasa Discord)",
        set_badgeMode: "Penghitung di tombol",
        badge_mentions: "Sebutan",
        badge_unread: "Server dan DM belum dibaca",
        badge_off: "Mati",
        set_interval: "Tandai sudah dibaca otomatis setiap",
        interval_off: "Tidak pernah",
        interval_minutes: "{n} menit",
        context_blacklist: "Kecualikan dari read all",
        tooltip_middle: "Klik tengah hanya menandai server saat ini sebagai sudah dibaca",
        set_olderThan: "Hanya tandai sudah dibaca pesan yang lebih lama dari",
        note_olderThan: "Pesan yang lebih baru tetap belum dibaca. Dalam mode ini, saluran dengan sebutan selalu tetap belum dibaca.",
        olderThan_off: "Semua pesan",
        olderThan_hours: "{n} jam",
        set_keepMentions: "Biarkan saluran dengan sebutan belum dibaca",
        channels_excluded: "Saluran yang dikecualikan (klik kanan saluran untuk menambahkan)",
        channels_none: "Tidak ada",
        button_clear: "Hapus semua",
        tooltip_more: "+{n} lainnya",
        set_confirm: "Tanya sebelum menandai atau menghapus",
        confirm_never: "Tidak pernah",
        confirm_always: "Selalu",
        confirm_from: "Mulai {n} sekaligus",
        set_clearMarksRead: "Menghapus sebutan juga menandai salurannya sebagai sudah dibaca",
        set_checkUpdates: "Periksa pembaruan",
        note_checkUpdates: "Mencari versi baru di GitHub dan menawarkan pemasangan dengan satu klik.",
        notice_update: "ReadAllNotificationsButtonv2 {version} tersedia.",
        button_update: "Perbarui",
        toast_updated: "Diperbarui ke {version}",
        toast_updateFailed: "Pembaruan gagal: {error}",
        set_buttonStyle: "Gaya tombol",
        style_text: "Teks",
        style_icon: "Ikon",
        style_both: "Ikon dan teks",
        set_readOnLeave: "Tandai server sebagai sudah dibaca saat pindah ke server lain",
        set_activeFrom: "Baca otomatis mulai",
        set_activeTo: "Baca otomatis sampai",
        note_activeHours: "Berlaku untuk interval, server yang dibisukan, dan saat mulai. Jam yang sama atau \"Kapan saja\" berarti selalu.",
        hours_any: "Kapan saja",
        set_clearHotkey: "Pintasan untuk menghapus sebutan",
        context_clear_all: "Semua sebutan",
        context_clear_server: "Sebutan dari server ini",
        context_clear_old: "Sebutan yang lebih lama dari satu hari",
        settings_stats: "Statistik",
        stats_text: "Ditandai sudah dibaca: {servers} server, {dms} pesan langsung · Sebutan dihapus: {mentions}",
        button_reset: "Atur ulang",
        toast_noMentions: "Tidak ada sebutan yang cocok",
    },
    it: {
        context_unreadguilds: "Server non letti",
        context_pingedguilds: "Server con menzioni",
        context_mutedguilds: "Server silenziati",
        context_guilds: "Tutti i server",
        context_dms: "Messaggi diretti",
        context_current: "Server attuale",
        context_others: "Tutti i server tranne quello attuale",
        context_folders: "Cartelle",
        context_alldms: "Tutti i messaggi diretti non letti",
        modal_title: "Conferma",
        modal_confirmnotifications: "Vuoi davvero segnare tutte le notifiche non lette come lette?",
        modal_confirmmentions: "Vuoi davvero rimuovere tutte le menzioni dall'elenco?",
        tooltip_clear: "Chiudi (tutto)",
        tooltip_button: "Non letti: {servers} server · {dms} MD\nMaiusc+clic segna tutto come letto",
        toast_alreadyclearing: "Sto già rimuovendo delle menzioni, attendi",
        toast_clearing: "Rimozione di {n} menzioni, ci vogliono circa {n} secondi",
        toast_cleared: "Tutte le menzioni recenti sono state rimosse",
        toast_read: "Segnato come letto · Server: {servers} · MD: {dms}",
        toast_nothing: "Non c'era niente da leggere",
        settings_general: "Impostazioni",
        settings_batch: "Il clic sinistro segna come letto",
        settings_extras: "Extra",
        settings_blacklist: "Lista nera dei server",
        set_addClearButton: "Aggiunge un pulsante alla finestra delle menzioni che le rimuove tutte",
        set_guilds: "Server non letti",
        set_muted: "Server silenziati",
        set_dms: "Messaggi diretti con menzioni",
        set_label: "Testo del pulsante",
        set_hideWhenEmpty: "Nasconde il pulsante finché non c'è nulla da leggere",
        set_toast: "Mostra quanto è stato segnato come letto",
        set_autoMuted: "Segna automaticamente come letti i server silenziati",
        note_autoMuted: "I nuovi messaggi nei server silenziati vengono segnati come letti dopo 5 secondi. Vale la lista nera.",
        set_readOnStart: "Segna tutto come letto all'avvio di Discord (come il clic sinistro)",
        set_hotkey: "Scorciatoia da tastiera",
        note_hotkey: "Fa lo stesso di un clic sinistro sul pulsante.",
        blacklist_note: "I server in grigio non vengono mai segnati come letti. Clicca su un server per cambiarlo.",
        blacklist_enable: "Attiva per tutti i server",
        blacklist_disable: "Disattiva per tutti i server",
        button_enable: "Attiva",
        button_disable: "Disattiva",
        set_language: "Lingua",
        note_language: "Vale subito. Riapri le impostazioni per vederle nella nuova lingua.",
        language_auto: "Automatica (lingua di Discord)",
        set_badgeMode: "Contatore sul pulsante",
        badge_mentions: "Menzioni",
        badge_unread: "Server e MD non letti",
        badge_off: "Disattivato",
        set_interval: "Segna come letto automaticamente ogni",
        interval_off: "Mai",
        interval_minutes: "{n} minuti",
        context_blacklist: "Escludi da read all",
        tooltip_middle: "Il clic centrale segna come letto solo il server attuale",
        set_olderThan: "Segna come letti solo i messaggi più vecchi di",
        note_olderThan: "I messaggi più recenti restano non letti. In questa modalità i canali con menzioni restano sempre non letti.",
        olderThan_off: "Tutti i messaggi",
        olderThan_hours: "{n} h",
        set_keepMentions: "Lascia non letti i canali con menzioni",
        channels_excluded: "Canali esclusi (clic destro su un canale per aggiungerlo)",
        channels_none: "Nessuno",
        button_clear: "Rimuovi tutti",
        tooltip_more: "+{n} altri",
        set_confirm: "Chiedi prima di segnare o cancellare",
        confirm_never: "Mai",
        confirm_always: "Sempre",
        confirm_from: "Da {n} alla volta",
        set_clearMarksRead: "Cancellare le menzioni segna anche i loro canali come letti",
        set_checkUpdates: "Cerca aggiornamenti",
        note_checkUpdates: "Cerca una nuova versione su GitHub e propone di installarla con un clic.",
        notice_update: "ReadAllNotificationsButtonv2 {version} è disponibile.",
        button_update: "Aggiorna",
        toast_updated: "Aggiornato a {version}",
        toast_updateFailed: "Aggiornamento non riuscito: {error}",
        set_buttonStyle: "Stile del pulsante",
        style_text: "Testo",
        style_icon: "Icona",
        style_both: "Icona e testo",
        set_readOnLeave: "Segna un server come letto quando passi a un altro",
        set_activeFrom: "Lettura automatica dalle",
        set_activeTo: "Lettura automatica fino alle",
        note_activeHours: "Vale per l'intervallo, i server silenziati e l'avvio. La stessa ora o «Qualsiasi ora» significa sempre.",
        hours_any: "Qualsiasi ora",
        set_clearHotkey: "Scorciatoia per cancellare le menzioni",
        context_clear_all: "Tutte le menzioni",
        context_clear_server: "Menzioni da questo server",
        context_clear_old: "Menzioni più vecchie di un giorno",
        settings_stats: "Statistiche",
        stats_text: "Segnati come letti: {servers} server, {dms} messaggi diretti · Menzioni cancellate: {mentions}",
        button_reset: "Reimposta",
        toast_noMentions: "Nessuna menzione corrispondente",
    },
    ja: {
        context_unreadguilds: "未読のサーバー",
        context_pingedguilds: "メンションのあるサーバー",
        context_mutedguilds: "ミュート中のサーバー",
        context_guilds: "すべてのサーバー",
        context_dms: "ダイレクトメッセージ",
        context_current: "現在のサーバー",
        context_others: "現在のサーバー以外のすべて",
        context_folders: "フォルダ",
        context_alldms: "未読のダイレクトメッセージすべて",
        modal_title: "確認",
        modal_confirmnotifications: "未読の通知をすべて既読にしますか？",
        modal_confirmmentions: "リストからすべてのメンションを削除しますか？",
        tooltip_clear: "閉じる（すべて）",
        tooltip_button: "未読: サーバー {servers} · DM {dms}\nShift+クリックですべて既読",
        toast_alreadyclearing: "メンションを削除中です。お待ちください",
        toast_clearing: "メンションを削除中 ({n})、約 {n} 秒かかります",
        toast_cleared: "最近のメンションをすべて削除しました",
        toast_read: "既読にしました · サーバー: {servers} · DM: {dms}",
        toast_nothing: "未読はありませんでした",
        settings_general: "設定",
        settings_batch: "左クリックで既読にする対象",
        settings_extras: "追加機能",
        settings_blacklist: "サーバーのブラックリスト",
        set_addClearButton: "メンション一覧にすべてのメンションを削除するボタンを追加",
        set_guilds: "未読のサーバー",
        set_muted: "ミュート中のサーバー",
        set_dms: "メンションのあるダイレクトメッセージ",
        set_label: "ボタンの文字",
        set_hideWhenEmpty: "未読がない間はボタンを隠す",
        set_toast: "既読にした数を表示",
        set_autoMuted: "ミュート中のサーバーを自動で既読にする",
        note_autoMuted: "ミュート中のサーバーの新着メッセージは 5 秒後に既読になります。ブラックリストが適用されます。",
        set_readOnStart: "Discord 起動時にすべて既読にする（左クリックと同じ対象）",
        set_hotkey: "キーボードショートカット",
        note_hotkey: "ボタンを左クリックしたときと同じ動作をします。",
        blacklist_note: "グレーのサーバーは既読になりません。サーバーをクリックすると切り替わります。",
        blacklist_enable: "すべてのサーバーで有効にする",
        blacklist_disable: "すべてのサーバーで無効にする",
        button_enable: "有効",
        button_disable: "無効",
        set_language: "言語",
        note_language: "すぐに反映されます。新しい言語で表示するには設定を開き直してください。",
        language_auto: "自動（Discord の言語）",
        set_badgeMode: "ボタンのカウンター",
        badge_mentions: "メンション",
        badge_unread: "未読のサーバーと DM",
        badge_off: "オフ",
        set_interval: "自動で既読にする間隔",
        interval_off: "しない",
        interval_minutes: "{n} 分",
        context_blacklist: "read all の対象外にする",
        tooltip_middle: "中クリックで現在のサーバーだけを既読にします",
        set_olderThan: "既読にするのはこれより古いメッセージだけ",
        note_olderThan: "新しいメッセージは未読のままです。このモードではメンションのあるチャンネルは常に未読のままです。",
        olderThan_off: "すべてのメッセージ",
        olderThan_hours: "{n} 時間",
        set_keepMentions: "メンションのあるチャンネルは未読のままにする",
        channels_excluded: "対象外のチャンネル（チャンネルを右クリックして追加）",
        channels_none: "なし",
        button_clear: "すべて解除",
        tooltip_more: "ほか {n} 件",
        set_confirm: "既読にする前や削除する前に確認する",
        confirm_never: "しない",
        confirm_always: "常に",
        confirm_from: "一度に{n}件以上のとき",
        set_clearMarksRead: "メンションを削除するとそのチャンネルも既読にする",
        set_checkUpdates: "アップデートを確認",
        note_checkUpdates: "GitHubで新しいバージョンを探し、ワンクリックでのインストールを提案します。",
        notice_update: "ReadAllNotificationsButtonv2 {version} が利用可能です。",
        button_update: "アップデート",
        toast_updated: "{version} にアップデートしました",
        toast_updateFailed: "アップデートに失敗しました: {error}",
        set_buttonStyle: "ボタンのスタイル",
        style_text: "テキスト",
        style_icon: "アイコン",
        style_both: "アイコンとテキスト",
        set_readOnLeave: "別のサーバーに移動したときに既読にする",
        set_activeFrom: "自動既読の開始",
        set_activeTo: "自動既読の終了",
        note_activeHours: "間隔、ミュート中のサーバー、起動時に適用されます。同じ時刻または「いつでも」は常に有効です。",
        hours_any: "いつでも",
        set_clearHotkey: "メンション削除のキー割り当て",
        context_clear_all: "すべてのメンション",
        context_clear_server: "このサーバーのメンション",
        context_clear_old: "1日以上前のメンション",
        settings_stats: "統計",
        stats_text: "既読にした数: サーバー {servers}、DM {dms} · 削除したメンション: {mentions}",
        button_reset: "リセット",
        toast_noMentions: "該当するメンションはありません",
    },
    ko: {
        context_unreadguilds: "읽지 않은 서버",
        context_pingedguilds: "멘션이 있는 서버",
        context_mutedguilds: "알림 끈 서버",
        context_guilds: "모든 서버",
        context_dms: "다이렉트 메시지",
        context_current: "현재 서버",
        context_others: "현재 서버를 제외한 모든 서버",
        context_folders: "폴더",
        context_alldms: "읽지 않은 모든 다이렉트 메시지",
        modal_title: "확인",
        modal_confirmnotifications: "읽지 않은 알림을 모두 읽음으로 표시할까요?",
        modal_confirmmentions: "목록에서 모든 멘션을 삭제할까요?",
        tooltip_clear: "닫기 (모두)",
        tooltip_button: "읽지 않음: 서버 {servers} · DM {dms}\nShift+클릭으로 모두 읽음 처리",
        toast_alreadyclearing: "이미 멘션을 삭제하는 중입니다. 잠시 기다려 주세요",
        toast_clearing: "멘션 삭제 중 ({n}), 약 {n}초 걸립니다",
        toast_cleared: "최근 멘션을 모두 삭제했습니다",
        toast_read: "읽음으로 표시함 · 서버: {servers} · DM: {dms}",
        toast_nothing: "읽지 않은 항목이 없었습니다",
        settings_general: "설정",
        settings_batch: "왼쪽 클릭 시 읽음으로 표시할 항목",
        settings_extras: "추가 기능",
        settings_blacklist: "서버 블랙리스트",
        set_addClearButton: "멘션 창에 모든 멘션을 삭제하는 버튼을 추가합니다",
        set_guilds: "읽지 않은 서버",
        set_muted: "알림 끈 서버",
        set_dms: "멘션이 있는 다이렉트 메시지",
        set_label: "버튼 텍스트",
        set_hideWhenEmpty: "읽지 않은 항목이 없으면 버튼을 숨깁니다",
        set_toast: "읽음으로 표시한 양을 보여줍니다",
        set_autoMuted: "알림 끈 서버를 자동으로 읽음 처리합니다",
        note_autoMuted: "알림 끈 서버의 새 메시지는 5초 후 읽음 처리됩니다. 블랙리스트가 적용됩니다.",
        set_readOnStart: "Discord 시작 시 모두 읽음 처리합니다 (왼쪽 클릭과 같은 대상)",
        set_hotkey: "단축키",
        note_hotkey: "버튼을 왼쪽 클릭한 것과 같습니다.",
        blacklist_note: "회색 서버는 읽음 처리되지 않습니다. 서버를 클릭해 전환하세요.",
        blacklist_enable: "모든 서버에서 켜기",
        blacklist_disable: "모든 서버에서 끄기",
        button_enable: "켜기",
        button_disable: "끄기",
        set_language: "언어",
        note_language: "바로 적용됩니다. 새 언어로 보려면 설정을 다시 여세요.",
        language_auto: "자동 (Discord 언어)",
        set_badgeMode: "버튼의 카운터",
        badge_mentions: "멘션",
        badge_unread: "읽지 않은 서버와 DM",
        badge_off: "끄기",
        set_interval: "자동으로 읽음 처리하는 간격",
        interval_off: "안 함",
        interval_minutes: "{n}분",
        context_blacklist: "read all에서 제외",
        tooltip_middle: "가운데 클릭은 현재 서버만 읽음 처리합니다",
        set_olderThan: "다음보다 오래된 메시지만 읽음 처리",
        note_olderThan: "더 최근 메시지는 읽지 않음으로 남습니다. 이 모드에서는 멘션이 있는 채널이 항상 읽지 않음으로 남습니다.",
        olderThan_off: "모든 메시지",
        olderThan_hours: "{n}시간",
        set_keepMentions: "멘션이 있는 채널은 읽지 않음으로 두기",
        channels_excluded: "제외한 채널 (채널을 우클릭해 추가)",
        channels_none: "없음",
        button_clear: "모두 해제",
        tooltip_more: "외 {n}개",
        set_confirm: "읽음 표시 또는 삭제 전에 확인",
        confirm_never: "안 함",
        confirm_always: "항상",
        confirm_from: "한 번에 {n}개 이상일 때",
        set_clearMarksRead: "멘션을 삭제하면 해당 채널도 읽음으로 표시",
        set_checkUpdates: "업데이트 확인",
        note_checkUpdates: "GitHub에서 새 버전을 찾아 클릭 한 번으로 설치하도록 안내합니다.",
        notice_update: "ReadAllNotificationsButtonv2 {version}을(를) 사용할 수 있습니다.",
        button_update: "업데이트",
        toast_updated: "{version}(으)로 업데이트했습니다",
        toast_updateFailed: "업데이트 실패: {error}",
        set_buttonStyle: "버튼 스타일",
        style_text: "텍스트",
        style_icon: "아이콘",
        style_both: "아이콘과 텍스트",
        set_readOnLeave: "다른 서버로 이동할 때 이전 서버를 읽음으로 표시",
        set_activeFrom: "자동 읽음 시작",
        set_activeTo: "자동 읽음 종료",
        note_activeHours: "간격, 알림 끈 서버, 시작 시에 적용됩니다. 같은 시간이나 \"언제나\"는 항상을 뜻합니다.",
        hours_any: "언제나",
        set_clearHotkey: "멘션 삭제 단축키",
        context_clear_all: "모든 멘션",
        context_clear_server: "이 서버의 멘션",
        context_clear_old: "하루 이상 지난 멘션",
        settings_stats: "통계",
        stats_text: "읽음으로 표시: 서버 {servers}개, 다이렉트 메시지 {dms}개 · 삭제한 멘션: {mentions}개",
        button_reset: "초기화",
        toast_noMentions: "일치하는 멘션이 없습니다",
    },
    lt: {
        context_unreadguilds: "Neperskaityti serveriai",
        context_pingedguilds: "Serveriai su paminėjimais",
        context_mutedguilds: "Nutildyti serveriai",
        context_guilds: "Visi serveriai",
        context_dms: "Asmeninės žinutės",
        context_current: "Dabartinis serveris",
        context_others: "Visi serveriai, išskyrus dabartinį",
        context_folders: "Aplankai",
        context_alldms: "Visos neperskaitytos asmeninės žinutės",
        modal_title: "Patvirtinti",
        modal_confirmnotifications: "Ar tikrai nori pažymėti visus neperskaitytus pranešimus kaip perskaitytus?",
        modal_confirmmentions: "Ar tikrai nori pašalinti visus paminėjimus iš sąrašo?",
        tooltip_clear: "Uždaryti (visus)",
        tooltip_button: "Neperskaityta: serveriai {servers} · AŽ {dms}\nShift+spustelėjimas pažymi viską kaip perskaitytą",
        toast_alreadyclearing: "Paminėjimai jau šalinami, palauk",
        toast_clearing: "Šalinami paminėjimai ({n}), užtruks apie {n} s",
        toast_cleared: "Visi naujausi paminėjimai pašalinti",
        toast_read: "Pažymėta kaip perskaityta · Serveriai: {servers} · AŽ: {dms}",
        toast_nothing: "Nieko neperskaityto nebuvo",
        settings_general: "Nustatymai",
        settings_batch: "Kairysis spustelėjimas pažymi kaip perskaitytą",
        settings_extras: "Papildomai",
        settings_blacklist: "Serverių juodasis sąrašas",
        set_addClearButton: "Prideda paminėjimų lange mygtuką, kuris pašalina visus paminėjimus",
        set_guilds: "Neperskaityti serveriai",
        set_muted: "Nutildyti serveriai",
        set_dms: "Asmeninės žinutės su paminėjimais",
        set_label: "Mygtuko tekstas",
        set_hideWhenEmpty: "Slepia mygtuką, kol nėra neperskaitytų",
        set_toast: "Rodo, kiek pažymėta kaip perskaityta",
        set_autoMuted: "Automatiškai pažymi nutildytus serverius kaip perskaitytus",
        note_autoMuted: "Naujos žinutės nutildytuose serveriuose pažymimos kaip perskaitytos po 5 sekundžių. Galioja juodasis sąrašas.",
        set_readOnStart: "Paleidus Discord pažymi viską kaip perskaitytą (kaip kairysis spustelėjimas)",
        set_hotkey: "Spartusis klavišas",
        note_hotkey: "Daro tą patį, ką kairysis spustelėjimas ant mygtuko.",
        blacklist_note: "Pilki serveriai niekada nepažymimi kaip perskaityti. Spustelėk serverį, kad perjungtum.",
        blacklist_enable: "Įjungti visiems serveriams",
        blacklist_disable: "Išjungti visiems serveriams",
        button_enable: "Įjungti",
        button_disable: "Išjungti",
        set_language: "Kalba",
        note_language: "Galioja iš karto. Atidaryk nustatymus iš naujo, kad matytum juos nauja kalba.",
        language_auto: "Automatiškai (Discord kalba)",
        set_badgeMode: "Skaitiklis ant mygtuko",
        badge_mentions: "Paminėjimai",
        badge_unread: "Neperskaityti serveriai ir AŽ",
        badge_off: "Išjungta",
        set_interval: "Automatiškai pažymėti kaip perskaitytą kas",
        interval_off: "Niekada",
        interval_minutes: "{n} min.",
        context_blacklist: "Neįtraukti į read all",
        tooltip_middle: "Vidurinis spustelėjimas pažymi kaip perskaitytą tik dabartinį serverį",
        set_olderThan: "Pažymėti kaip perskaitytas tik žinutes, senesnes nei",
        note_olderThan: "Naujesnės žinutės lieka neperskaitytos. Šiuo režimu kanalai su paminėjimais visada lieka neperskaityti.",
        olderThan_off: "Visos žinutės",
        olderThan_hours: "{n} val.",
        set_keepMentions: "Kanalus su paminėjimais palikti neperskaitytus",
        channels_excluded: "Neįtraukti kanalai (dešiniuoju spustelėk kanalą, kad pridėtum)",
        channels_none: "Nėra",
        button_clear: "Pašalinti visus",
        tooltip_more: "+{n} daugiau",
        set_confirm: "Klausti prieš žymint ar išvalant",
        confirm_never: "Niekada",
        confirm_always: "Visada",
        confirm_from: "Nuo {n} vienu metu",
        set_clearMarksRead: "Išvalius paminėjimus, jų kanalai taip pat pažymimi kaip perskaityti",
        set_checkUpdates: "Tikrinti atnaujinimus",
        note_checkUpdates: "Ieško naujos versijos „GitHub“ ir pasiūlo ją įdiegti vienu spustelėjimu.",
        notice_update: "Galima ReadAllNotificationsButtonv2 {version} versija.",
        button_update: "Atnaujinti",
        toast_updated: "Atnaujinta į {version}",
        toast_updateFailed: "Atnaujinti nepavyko: {error}",
        set_buttonStyle: "Mygtuko stilius",
        style_text: "Tekstas",
        style_icon: "Piktograma",
        style_both: "Piktograma ir tekstas",
        set_readOnLeave: "Pažymėti serverį kaip perskaitytą, kai pereinate į kitą",
        set_activeFrom: "Automatinis skaitymas nuo",
        set_activeTo: "Automatinis skaitymas iki",
        note_activeHours: "Taikoma intervalui, nutildytiems serveriams ir paleidimui. Ta pati valanda arba „Bet kada“ reiškia visada.",
        hours_any: "Bet kada",
        set_clearHotkey: "Spartusis klavišas paminėjimams išvalyti",
        context_clear_all: "Visi paminėjimai",
        context_clear_server: "Paminėjimai iš šio serverio",
        context_clear_old: "Senesni nei vienos dienos paminėjimai",
        settings_stats: "Statistika",
        stats_text: "Pažymėta kaip perskaityta: serverių {servers}, asmeninių žinučių {dms} · Išvalyta paminėjimų: {mentions}",
        button_reset: "Nustatyti iš naujo",
        toast_noMentions: "Tinkamų paminėjimų nėra",
    },
    nl: {
        context_unreadguilds: "Ongelezen servers",
        context_pingedguilds: "Servers met vermeldingen",
        context_mutedguilds: "Gedempte servers",
        context_guilds: "Alle servers",
        context_dms: "Privéberichten",
        context_current: "Huidige server",
        context_others: "Alle servers behalve de huidige",
        context_folders: "Mappen",
        context_alldms: "Alle ongelezen privéberichten",
        modal_title: "Bevestigen",
        modal_confirmnotifications: "Weet je zeker dat je alle ongelezen meldingen als gelezen wilt markeren?",
        modal_confirmmentions: "Weet je zeker dat je alle vermeldingen uit de lijst wilt verwijderen?",
        tooltip_clear: "Sluiten (alles)",
        tooltip_button: "Ongelezen: {servers} servers · {dms} DM's\nShift+klik markeert alles als gelezen",
        toast_alreadyclearing: "Er worden al vermeldingen verwijderd, even geduld",
        toast_clearing: "{n} vermeldingen verwijderen, dit duurt ongeveer {n} seconden",
        toast_cleared: "Alle recente vermeldingen zijn verwijderd",
        toast_read: "Als gelezen gemarkeerd · Servers: {servers} · DM's: {dms}",
        toast_nothing: "Er was niets ongelezen",
        settings_general: "Instellingen",
        settings_batch: "Linksklikken markeert het volgende als gelezen",
        settings_extras: "Extra's",
        settings_blacklist: "Zwarte lijst van servers",
        set_addClearButton: "Voegt een knop toe aan het vermeldingenvenster die alle vermeldingen verwijdert",
        set_guilds: "Ongelezen servers",
        set_muted: "Gedempte servers",
        set_dms: "Privéberichten met vermeldingen",
        set_label: "Knoptekst",
        set_hideWhenEmpty: "Verbergt de knop zolang er niets ongelezen is",
        set_toast: "Toont hoeveel als gelezen is gemarkeerd",
        set_autoMuted: "Markeert gedempte servers automatisch als gelezen",
        note_autoMuted: "Nieuwe berichten in gedempte servers worden na 5 seconden als gelezen gemarkeerd. De zwarte lijst geldt.",
        set_readOnStart: "Markeert alles als gelezen bij het starten van Discord (volgens linksklikken)",
        set_hotkey: "Sneltoets",
        note_hotkey: "Doet hetzelfde als linksklikken op de knop.",
        blacklist_note: "Grijze servers worden nooit als gelezen gemarkeerd. Klik op een server om te wisselen.",
        blacklist_enable: "Inschakelen voor alle servers",
        blacklist_disable: "Uitschakelen voor alle servers",
        button_enable: "Inschakelen",
        button_disable: "Uitschakelen",
        set_language: "Taal",
        note_language: "Geldt meteen. Open de instellingen opnieuw om ze in de nieuwe taal te zien.",
        language_auto: "Automatisch (taal van Discord)",
        set_badgeMode: "Teller op de knop",
        badge_mentions: "Vermeldingen",
        badge_unread: "Ongelezen servers en DM's",
        badge_off: "Uit",
        set_interval: "Automatisch als gelezen markeren elke",
        interval_off: "Nooit",
        interval_minutes: "{n} minuten",
        context_blacklist: "Uitsluiten van read all",
        tooltip_middle: "Middelklik markeert alleen de huidige server als gelezen",
        set_olderThan: "Alleen berichten als gelezen markeren die ouder zijn dan",
        note_olderThan: "Nieuwere berichten blijven ongelezen. Kanalen met vermeldingen blijven in deze modus altijd ongelezen.",
        olderThan_off: "Alle berichten",
        olderThan_hours: "{n} u",
        set_keepMentions: "Kanalen met vermeldingen ongelezen laten",
        channels_excluded: "Uitgesloten kanalen (rechtsklik op een kanaal om toe te voegen)",
        channels_none: "Geen",
        button_clear: "Alles verwijderen",
        tooltip_more: "+{n} meer",
        set_confirm: "Vragen voor markeren of wissen",
        confirm_never: "Nooit",
        confirm_always: "Altijd",
        confirm_from: "Vanaf {n} tegelijk",
        set_clearMarksRead: "Vermeldingen wissen markeert ook hun kanalen als gelezen",
        set_checkUpdates: "Zoeken naar updates",
        note_checkUpdates: "Zoekt op GitHub naar een nieuwe versie en biedt aan die met één klik te installeren.",
        notice_update: "ReadAllNotificationsButtonv2 {version} is beschikbaar.",
        button_update: "Bijwerken",
        toast_updated: "Bijgewerkt naar {version}",
        toast_updateFailed: "Bijwerken mislukt: {error}",
        set_buttonStyle: "Stijl van de knop",
        style_text: "Tekst",
        style_icon: "Pictogram",
        style_both: "Pictogram en tekst",
        set_readOnLeave: "Een server als gelezen markeren wanneer je naar een andere gaat",
        set_activeFrom: "Automatisch lezen vanaf",
        set_activeTo: "Automatisch lezen tot",
        note_activeHours: "Geldt voor het interval, gedempte servers en het opstarten. Hetzelfde uur of 'Elk tijdstip' betekent altijd.",
        hours_any: "Elk tijdstip",
        set_clearHotkey: "Sneltoets voor het wissen van vermeldingen",
        context_clear_all: "Alle vermeldingen",
        context_clear_server: "Vermeldingen uit deze server",
        context_clear_old: "Vermeldingen ouder dan een dag",
        settings_stats: "Statistieken",
        stats_text: "Als gelezen gemarkeerd: {servers} servers, {dms} privéberichten · Vermeldingen gewist: {mentions}",
        button_reset: "Herstellen",
        toast_noMentions: "Geen passende vermeldingen",
    },
    no: {
        context_unreadguilds: "Uleste servere",
        context_pingedguilds: "Servere med omtaler",
        context_mutedguilds: "Dempede servere",
        context_guilds: "Alle servere",
        context_dms: "Direktemeldinger",
        context_current: "Nåværende server",
        context_others: "Alle servere unntatt den nåværende",
        context_folders: "Mapper",
        context_alldms: "Alle uleste direktemeldinger",
        modal_title: "Bekreft",
        modal_confirmnotifications: "Er du sikker på at du vil merke alle uleste varsler som lest?",
        modal_confirmmentions: "Er du sikker på at du vil fjerne alle omtaler fra listen?",
        tooltip_clear: "Lukk (alle)",
        tooltip_button: "Ulest: {servers} servere · {dms} DM-er\nShift+klikk merker alt som lest",
        toast_alreadyclearing: "Omtaler fjernes allerede, vent litt",
        toast_clearing: "Fjerner {n} omtaler, det tar omtrent {n} sekunder",
        toast_cleared: "Alle nylige omtaler er fjernet",
        toast_read: "Merket som lest · Servere: {servers} · DM-er: {dms}",
        toast_nothing: "Ingenting var ulest",
        settings_general: "Innstillinger",
        settings_batch: "Venstreklikk merker følgende som lest",
        settings_extras: "Ekstra",
        settings_blacklist: "Svarteliste for servere",
        set_addClearButton: "Legger til en knapp i omtalevinduet som fjerner alle omtaler",
        set_guilds: "Uleste servere",
        set_muted: "Dempede servere",
        set_dms: "Direktemeldinger med omtaler",
        set_label: "Knappetekst",
        set_hideWhenEmpty: "Skjuler knappen så lenge ingenting er ulest",
        set_toast: "Viser hvor mye som ble merket som lest",
        set_autoMuted: "Merker dempede servere automatisk som lest",
        note_autoMuted: "Nye meldinger på dempede servere merkes som lest etter 5 sekunder. Svartelisten gjelder.",
        set_readOnStart: "Merker alt som lest når Discord starter (som venstreklikk)",
        set_hotkey: "Hurtigtast",
        note_hotkey: "Gjør det samme som et venstreklikk på knappen.",
        blacklist_note: "Grå servere merkes aldri som lest. Klikk på en server for å bytte.",
        blacklist_enable: "Aktiver for alle servere",
        blacklist_disable: "Deaktiver for alle servere",
        button_enable: "Aktiver",
        button_disable: "Deaktiver",
        set_language: "Språk",
        note_language: "Gjelder med en gang. Åpne innstillingene på nytt for å se dem på det nye språket.",
        language_auto: "Automatisk (Discords språk)",
        set_badgeMode: "Teller på knappen",
        badge_mentions: "Omtaler",
        badge_unread: "Uleste servere og DM-er",
        badge_off: "Av",
        set_interval: "Merk automatisk som lest hvert",
        interval_off: "Aldri",
        interval_minutes: "{n} minutter",
        context_blacklist: "Utelat fra read all",
        tooltip_middle: "Midtklikk merker bare den nåværende serveren som lest",
        set_olderThan: "Merk bare meldinger som lest som er eldre enn",
        note_olderThan: "Nyere meldinger forblir uleste. Kanaler med omtaler forblir alltid uleste i denne modusen.",
        olderThan_off: "Alle meldinger",
        olderThan_hours: "{n} t",
        set_keepMentions: "La kanaler med omtaler forbli uleste",
        channels_excluded: "Utelatte kanaler (høyreklikk på en kanal for å legge til)",
        channels_none: "Ingen",
        button_clear: "Fjern alle",
        tooltip_more: "+{n} til",
        set_confirm: "Spør før markering eller tømming",
        confirm_never: "Aldri",
        confirm_always: "Alltid",
        confirm_from: "Fra {n} om gangen",
        set_clearMarksRead: "Tømming av omtaler markerer også kanalene deres som lest",
        set_checkUpdates: "Se etter oppdateringer",
        note_checkUpdates: "Ser etter en ny versjon på GitHub og tilbyr å installere den med ett klikk.",
        notice_update: "ReadAllNotificationsButtonv2 {version} er tilgjengelig.",
        button_update: "Oppdater",
        toast_updated: "Oppdatert til {version}",
        toast_updateFailed: "Oppdateringen mislyktes: {error}",
        set_buttonStyle: "Knappestil",
        style_text: "Tekst",
        style_icon: "Ikon",
        style_both: "Ikon og tekst",
        set_readOnLeave: "Merk en server som lest når du bytter til en annen",
        set_activeFrom: "Automatisk lesing fra",
        set_activeTo: "Automatisk lesing til",
        note_activeHours: "Gjelder intervallet, dempede servere og oppstart. Samme time eller «Når som helst» betyr alltid.",
        hours_any: "Når som helst",
        set_clearHotkey: "Hurtigtast for å tømme omtaler",
        context_clear_all: "Alle omtaler",
        context_clear_server: "Omtaler fra denne serveren",
        context_clear_old: "Omtaler eldre enn én dag",
        settings_stats: "Statistikk",
        stats_text: "Markert som lest: {servers} servere, {dms} direktemeldinger · Omtaler tømt: {mentions}",
        button_reset: "Tilbakestill",
        toast_noMentions: "Ingen omtaler som passer",
    },
    pl: {
        context_unreadguilds: "Nieprzeczytane serwery",
        context_pingedguilds: "Serwery ze wzmiankami",
        context_mutedguilds: "Wyciszone serwery",
        context_guilds: "Wszystkie serwery",
        context_dms: "Wiadomości prywatne",
        context_current: "Bieżący serwer",
        context_others: "Wszystkie serwery oprócz bieżącego",
        context_folders: "Foldery",
        context_alldms: "Wszystkie nieprzeczytane wiadomości prywatne",
        modal_title: "Potwierdź",
        modal_confirmnotifications: "Czy na pewno chcesz oznaczyć wszystkie nieprzeczytane powiadomienia jako przeczytane?",
        modal_confirmmentions: "Czy na pewno chcesz usunąć wszystkie wzmianki z listy?",
        tooltip_clear: "Zamknij (wszystkie)",
        tooltip_button: "Nieprzeczytane: serwery {servers} · DM {dms}\nShift+klik oznacza wszystko jako przeczytane",
        toast_alreadyclearing: "Wzmianki są już usuwane, poczekaj",
        toast_clearing: "Usuwanie wzmianek ({n}), potrwa to ok. {n} s",
        toast_cleared: "Wszystkie ostatnie wzmianki zostały usunięte",
        toast_read: "Oznaczono jako przeczytane · Serwery: {servers} · DM: {dms}",
        toast_nothing: "Nic nie było nieprzeczytane",
        settings_general: "Ustawienia",
        settings_batch: "Lewy klik oznacza jako przeczytane",
        settings_extras: "Dodatki",
        settings_blacklist: "Czarna lista serwerów",
        set_addClearButton: "Dodaje do okna wzmianek przycisk, który usuwa wszystkie wzmianki",
        set_guilds: "Nieprzeczytane serwery",
        set_muted: "Wyciszone serwery",
        set_dms: "Wiadomości prywatne ze wzmiankami",
        set_label: "Tekst przycisku",
        set_hideWhenEmpty: "Ukrywa przycisk, gdy nic nie jest nieprzeczytane",
        set_toast: "Pokazuje, ile oznaczono jako przeczytane",
        set_autoMuted: "Automatycznie oznacza wyciszone serwery jako przeczytane",
        note_autoMuted: "Nowe wiadomości na wyciszonych serwerach są oznaczane jako przeczytane po 5 sekundach. Obowiązuje czarna lista.",
        set_readOnStart: "Oznacza wszystko jako przeczytane przy starcie Discorda (jak lewy klik)",
        set_hotkey: "Skrót klawiszowy",
        note_hotkey: "Działa tak samo jak lewy klik na przycisku.",
        blacklist_note: "Wyszarzone serwery nigdy nie są oznaczane jako przeczytane. Kliknij serwer, aby przełączyć.",
        blacklist_enable: "Włącz dla wszystkich serwerów",
        blacklist_disable: "Wyłącz dla wszystkich serwerów",
        button_enable: "Włącz",
        button_disable: "Wyłącz",
        set_language: "Język",
        note_language: "Działa od razu. Otwórz ustawienia ponownie, aby zobaczyć je w nowym języku.",
        language_auto: "Automatycznie (język Discorda)",
        set_badgeMode: "Licznik na przycisku",
        badge_mentions: "Wzmianki",
        badge_unread: "Nieprzeczytane serwery i DM",
        badge_off: "Wyłączony",
        set_interval: "Automatycznie oznaczaj jako przeczytane co",
        interval_off: "Nigdy",
        interval_minutes: "{n} min",
        context_blacklist: "Wyklucz z read all",
        tooltip_middle: "Środkowy klik oznacza jako przeczytany tylko bieżący serwer",
        set_olderThan: "Oznaczaj jako przeczytane tylko wiadomości starsze niż",
        note_olderThan: "Nowsze wiadomości pozostają nieprzeczytane. W tym trybie kanały ze wzmiankami zawsze pozostają nieprzeczytane.",
        olderThan_off: "Wszystkie wiadomości",
        olderThan_hours: "{n} godz.",
        set_keepMentions: "Zostaw kanały ze wzmiankami nieprzeczytane",
        channels_excluded: "Wykluczone kanały (kliknij kanał prawym przyciskiem, aby dodać)",
        channels_none: "Brak",
        button_clear: "Usuń wszystkie",
        tooltip_more: "+{n} więcej",
        set_confirm: "Pytaj przed oznaczaniem lub usuwaniem",
        confirm_never: "Nigdy",
        confirm_always: "Zawsze",
        confirm_from: "Od {n} naraz",
        set_clearMarksRead: "Usuwanie wzmianek oznacza też ich kanały jako przeczytane",
        set_checkUpdates: "Sprawdzaj aktualizacje",
        note_checkUpdates: "Szuka nowej wersji na GitHubie i proponuje instalację jednym kliknięciem.",
        notice_update: "ReadAllNotificationsButtonv2 {version} jest dostępny.",
        button_update: "Aktualizuj",
        toast_updated: "Zaktualizowano do {version}",
        toast_updateFailed: "Aktualizacja nie powiodła się: {error}",
        set_buttonStyle: "Styl przycisku",
        style_text: "Tekst",
        style_icon: "Ikona",
        style_both: "Ikona i tekst",
        set_readOnLeave: "Oznaczaj serwer jako przeczytany po przejściu na inny",
        set_activeFrom: "Automatyczne czytanie od",
        set_activeTo: "Automatyczne czytanie do",
        note_activeHours: "Dotyczy interwału, wyciszonych serwerów i startu. Ta sama godzina lub „Dowolna pora” oznacza zawsze.",
        hours_any: "Dowolna pora",
        set_clearHotkey: "Skrót do usuwania wzmianek",
        context_clear_all: "Wszystkie wzmianki",
        context_clear_server: "Wzmianki z tego serwera",
        context_clear_old: "Wzmianki starsze niż jeden dzień",
        settings_stats: "Statystyki",
        stats_text: "Oznaczono jako przeczytane: serwery {servers}, wiadomości prywatne {dms} · Usunięte wzmianki: {mentions}",
        button_reset: "Resetuj",
        toast_noMentions: "Brak pasujących wzmianek",
    },
    "pt-BR": {
        context_unreadguilds: "Servidores não lidos",
        context_pingedguilds: "Servidores com menções",
        context_mutedguilds: "Servidores silenciados",
        context_guilds: "Todos os servidores",
        context_dms: "Mensagens diretas",
        context_current: "Servidor atual",
        context_others: "Todos os servidores exceto o atual",
        context_folders: "Pastas",
        context_alldms: "Todas as mensagens diretas não lidas",
        modal_title: "Confirmar",
        modal_confirmnotifications: "Tem certeza de que deseja marcar todas as notificações não lidas como lidas?",
        modal_confirmmentions: "Tem certeza de que deseja remover todas as menções da lista?",
        tooltip_clear: "Fechar (tudo)",
        tooltip_button: "Não lidos: {servers} servidores · {dms} MDs\nShift+clique marca tudo como lido",
        toast_alreadyclearing: "Já estou removendo menções, aguarde",
        toast_clearing: "Removendo {n} menções, isso leva cerca de {n} segundos",
        toast_cleared: "Todas as menções recentes foram removidas",
        toast_read: "Marcado como lido · Servidores: {servers} · MDs: {dms}",
        toast_nothing: "Não havia nada não lido",
        settings_general: "Configurações",
        settings_batch: "O clique esquerdo marca como lido",
        settings_extras: "Extras",
        settings_blacklist: "Lista negra de servidores",
        set_addClearButton: "Adiciona um botão à janela de menções que remove todas",
        set_guilds: "Servidores não lidos",
        set_muted: "Servidores silenciados",
        set_dms: "Mensagens diretas com menções",
        set_label: "Texto do botão",
        set_hideWhenEmpty: "Oculta o botão enquanto não houver nada não lido",
        set_toast: "Mostra quanto foi marcado como lido",
        set_autoMuted: "Marca automaticamente servidores silenciados como lidos",
        note_autoMuted: "Novas mensagens em servidores silenciados são marcadas como lidas após 5 segundos. A lista negra se aplica.",
        set_readOnStart: "Marca tudo como lido ao iniciar o Discord (conforme o clique esquerdo)",
        set_hotkey: "Atalho de teclado",
        note_hotkey: "Faz o mesmo que um clique esquerdo no botão.",
        blacklist_note: "Servidores em cinza nunca são marcados como lidos. Clique em um servidor para alternar.",
        blacklist_enable: "Ativar para todos os servidores",
        blacklist_disable: "Desativar para todos os servidores",
        button_enable: "Ativar",
        button_disable: "Desativar",
        set_language: "Idioma",
        note_language: "Vale na hora. Reabra as configurações para vê-las no novo idioma.",
        language_auto: "Automático (idioma do Discord)",
        set_badgeMode: "Contador no botão",
        badge_mentions: "Menções",
        badge_unread: "Servidores e MDs não lidos",
        badge_off: "Desativado",
        set_interval: "Marcar como lido automaticamente a cada",
        interval_off: "Nunca",
        interval_minutes: "{n} minutos",
        context_blacklist: "Excluir do read all",
        tooltip_middle: "O clique do meio marca como lido apenas o servidor atual",
        set_olderThan: "Marcar como lidas só as mensagens mais antigas que",
        note_olderThan: "Mensagens mais novas continuam não lidas. Neste modo, canais com menções sempre continuam não lidos.",
        olderThan_off: "Todas as mensagens",
        olderThan_hours: "{n} h",
        set_keepMentions: "Deixar canais com menções não lidos",
        channels_excluded: "Canais excluídos (clique com o botão direito em um canal para adicionar)",
        channels_none: "Nenhum",
        button_clear: "Remover todos",
        tooltip_more: "+{n} outros",
        set_confirm: "Perguntar antes de marcar ou limpar",
        confirm_never: "Nunca",
        confirm_always: "Sempre",
        confirm_from: "A partir de {n} de uma vez",
        set_clearMarksRead: "Limpar menções também marca os canais delas como lidos",
        set_checkUpdates: "Procurar atualizações",
        note_checkUpdates: "Procura uma nova versão no GitHub e oferece instalá-la com um clique.",
        notice_update: "ReadAllNotificationsButtonv2 {version} está disponível.",
        button_update: "Atualizar",
        toast_updated: "Atualizado para {version}",
        toast_updateFailed: "Falha na atualização: {error}",
        set_buttonStyle: "Estilo do botão",
        style_text: "Texto",
        style_icon: "Ícone",
        style_both: "Ícone e texto",
        set_readOnLeave: "Marcar um servidor como lido ao mudar para outro",
        set_activeFrom: "Leitura automática a partir de",
        set_activeTo: "Leitura automática até",
        note_activeHours: "Vale para o intervalo, os servidores silenciados e a inicialização. O mesmo horário ou \"Qualquer hora\" significa sempre.",
        hours_any: "Qualquer hora",
        set_clearHotkey: "Atalho para limpar menções",
        context_clear_all: "Todas as menções",
        context_clear_server: "Menções deste servidor",
        context_clear_old: "Menções com mais de um dia",
        settings_stats: "Estatísticas",
        stats_text: "Marcados como lidos: {servers} servidores, {dms} mensagens diretas · Menções limpas: {mentions}",
        button_reset: "Redefinir",
        toast_noMentions: "Nenhuma menção correspondente",
    },
    ro: {
        context_unreadguilds: "Servere necitite",
        context_pingedguilds: "Servere cu mențiuni",
        context_mutedguilds: "Servere fără sunet",
        context_guilds: "Toate serverele",
        context_dms: "Mesaje directe",
        context_current: "Serverul curent",
        context_others: "Toate serverele în afară de cel curent",
        context_folders: "Dosare",
        context_alldms: "Toate mesajele directe necitite",
        modal_title: "Confirmare",
        modal_confirmnotifications: "Sigur vrei să marchezi toate notificările necitite ca citite?",
        modal_confirmmentions: "Sigur vrei să elimini toate mențiunile din listă?",
        tooltip_clear: "Închide (toate)",
        tooltip_button: "Necitite: servere {servers} · MD {dms}\nShift+clic marchează totul ca citit",
        toast_alreadyclearing: "Mențiunile se elimină deja, așteaptă",
        toast_clearing: "Se elimină mențiunile ({n}), durează cam {n} secunde",
        toast_cleared: "Toate mențiunile recente au fost eliminate",
        toast_read: "Marcat ca citit · Servere: {servers} · MD: {dms}",
        toast_nothing: "Nu era nimic necitit",
        settings_general: "Setări",
        settings_batch: "Clicul stânga marchează ca citit",
        settings_extras: "Extra",
        settings_blacklist: "Lista neagră de servere",
        set_addClearButton: "Adaugă în fereastra de mențiuni un buton care le elimină pe toate",
        set_guilds: "Servere necitite",
        set_muted: "Servere fără sunet",
        set_dms: "Mesaje directe cu mențiuni",
        set_label: "Textul butonului",
        set_hideWhenEmpty: "Ascunde butonul cât timp nu e nimic necitit",
        set_toast: "Afișează cât a fost marcat ca citit",
        set_autoMuted: "Marchează automat serverele fără sunet ca citite",
        note_autoMuted: "Mesajele noi din serverele fără sunet sunt marcate ca citite după 5 secunde. Se aplică lista neagră.",
        set_readOnStart: "Marchează totul ca citit la pornirea Discord (ca la clic stânga)",
        set_hotkey: "Scurtătură de tastatură",
        note_hotkey: "Face același lucru ca un clic stânga pe buton.",
        blacklist_note: "Serverele gri nu sunt niciodată marcate ca citite. Dă clic pe un server pentru a comuta.",
        blacklist_enable: "Activează pentru toate serverele",
        blacklist_disable: "Dezactivează pentru toate serverele",
        button_enable: "Activează",
        button_disable: "Dezactivează",
        set_language: "Limbă",
        note_language: "Se aplică imediat. Redeschide setările ca să le vezi în noua limbă.",
        language_auto: "Automat (limba Discord)",
        set_badgeMode: "Contor pe buton",
        badge_mentions: "Mențiuni",
        badge_unread: "Servere și MD necitite",
        badge_off: "Oprit",
        set_interval: "Marchează automat ca citit la fiecare",
        interval_off: "Niciodată",
        interval_minutes: "{n} minute",
        context_blacklist: "Exclude din read all",
        tooltip_middle: "Clicul din mijloc marchează ca citit doar serverul curent",
        set_olderThan: "Marchează ca citite doar mesajele mai vechi de",
        note_olderThan: "Mesajele mai noi rămân necitite. În acest mod, canalele cu mențiuni rămân mereu necitite.",
        olderThan_off: "Toate mesajele",
        olderThan_hours: "{n} h",
        set_keepMentions: "Lasă necitite canalele cu mențiuni",
        channels_excluded: "Canale excluse (clic dreapta pe un canal pentru a-l adăuga)",
        channels_none: "Niciunul",
        button_clear: "Elimină toate",
        tooltip_more: "+{n} în plus",
        set_confirm: "Întreabă înainte de marcare sau ștergere",
        confirm_never: "Niciodată",
        confirm_always: "Întotdeauna",
        confirm_from: "De la {n} deodată",
        set_clearMarksRead: "Ștergerea mențiunilor marchează și canalele lor ca citite",
        set_checkUpdates: "Caută actualizări",
        note_checkUpdates: "Caută o versiune nouă pe GitHub și oferă instalarea cu un singur clic.",
        notice_update: "ReadAllNotificationsButtonv2 {version} este disponibil.",
        button_update: "Actualizează",
        toast_updated: "Actualizat la {version}",
        toast_updateFailed: "Actualizarea a eșuat: {error}",
        set_buttonStyle: "Stilul butonului",
        style_text: "Text",
        style_icon: "Pictogramă",
        style_both: "Pictogramă și text",
        set_readOnLeave: "Marchează un server ca citit când treci la altul",
        set_activeFrom: "Citire automată de la",
        set_activeTo: "Citire automată până la",
        note_activeHours: "Se aplică intervalului, serverelor fără sunet și pornirii. Aceeași oră sau „Oricând” înseamnă mereu.",
        hours_any: "Oricând",
        set_clearHotkey: "Comandă rapidă pentru ștergerea mențiunilor",
        context_clear_all: "Toate mențiunile",
        context_clear_server: "Mențiuni de pe acest server",
        context_clear_old: "Mențiuni mai vechi de o zi",
        settings_stats: "Statistici",
        stats_text: "Marcate ca citite: {servers} servere, {dms} mesaje directe · Mențiuni șterse: {mentions}",
        button_reset: "Resetează",
        toast_noMentions: "Nicio mențiune potrivită",
    },
    ru: {
        context_unreadguilds: "Непрочитанные серверы",
        context_pingedguilds: "Серверы с упоминаниями",
        context_mutedguilds: "Заглушённые серверы",
        context_guilds: "Все серверы",
        context_dms: "Личные сообщения",
        context_current: "Текущий сервер",
        context_others: "Все серверы, кроме текущего",
        context_folders: "Папки",
        context_alldms: "Все непрочитанные личные сообщения",
        modal_title: "Подтверждение",
        modal_confirmnotifications: "Отметить все непрочитанные уведомления как прочитанные?",
        modal_confirmmentions: "Удалить все упоминания из списка?",
        tooltip_clear: "Закрыть (все)",
        tooltip_button: "Непрочитано: серверы {servers} · ЛС {dms}\nShift+клик отмечает всё как прочитанное",
        toast_alreadyclearing: "Упоминания уже удаляются, подождите",
        toast_clearing: "Удаление упоминаний ({n}), займёт около {n} с",
        toast_cleared: "Все недавние упоминания удалены",
        toast_read: "Отмечено как прочитанное · Серверы: {servers} · ЛС: {dms}",
        toast_nothing: "Непрочитанного не было",
        settings_general: "Настройки",
        settings_batch: "Левый клик отмечает как прочитанное",
        settings_extras: "Дополнительно",
        settings_blacklist: "Чёрный список серверов",
        set_addClearButton: "Добавляет в окно упоминаний кнопку, удаляющую все упоминания",
        set_guilds: "Непрочитанные серверы",
        set_muted: "Заглушённые серверы",
        set_dms: "Личные сообщения с упоминаниями",
        set_label: "Текст кнопки",
        set_hideWhenEmpty: "Скрывать кнопку, пока нет непрочитанного",
        set_toast: "Показывать, сколько отмечено как прочитанное",
        set_autoMuted: "Автоматически отмечать заглушённые серверы как прочитанные",
        note_autoMuted: "Новые сообщения на заглушённых серверах отмечаются как прочитанные через 5 секунд. Чёрный список учитывается.",
        set_readOnStart: "Отмечать всё как прочитанное при запуске Discord (как левый клик)",
        set_hotkey: "Сочетание клавиш",
        note_hotkey: "Делает то же, что левый клик по кнопке.",
        blacklist_note: "Серые серверы никогда не отмечаются как прочитанные. Нажмите на сервер, чтобы переключить.",
        blacklist_enable: "Включить для всех серверов",
        blacklist_disable: "Отключить для всех серверов",
        button_enable: "Включить",
        button_disable: "Отключить",
        set_language: "Язык",
        note_language: "Применяется сразу. Откройте настройки заново, чтобы увидеть их на новом языке.",
        language_auto: "Автоматически (язык Discord)",
        set_badgeMode: "Счётчик на кнопке",
        badge_mentions: "Упоминания",
        badge_unread: "Непрочитанные серверы и ЛС",
        badge_off: "Выключен",
        set_interval: "Автоматически отмечать как прочитанное каждые",
        interval_off: "Никогда",
        interval_minutes: "{n} мин",
        context_blacklist: "Исключить из read all",
        tooltip_middle: "Средний клик отмечает как прочитанный только текущий сервер",
        set_olderThan: "Отмечать прочитанными только сообщения старше",
        note_olderThan: "Более новые сообщения остаются непрочитанными. В этом режиме каналы с упоминаниями всегда остаются непрочитанными.",
        olderThan_off: "Все сообщения",
        olderThan_hours: "{n} ч",
        set_keepMentions: "Оставлять каналы с упоминаниями непрочитанными",
        channels_excluded: "Исключённые каналы (правый клик по каналу, чтобы добавить)",
        channels_none: "Нет",
        button_clear: "Удалить все",
        tooltip_more: "+{n} ещё",
        set_confirm: "Спрашивать перед отметкой или очисткой",
        confirm_never: "Никогда",
        confirm_always: "Всегда",
        confirm_from: "От {n} за раз",
        set_clearMarksRead: "Очистка упоминаний также отмечает их каналы прочитанными",
        set_checkUpdates: "Проверять обновления",
        note_checkUpdates: "Ищет новую версию на GitHub и предлагает установить её одним щелчком.",
        notice_update: "Доступна версия ReadAllNotificationsButtonv2 {version}.",
        button_update: "Обновить",
        toast_updated: "Обновлено до {version}",
        toast_updateFailed: "Не удалось обновить: {error}",
        set_buttonStyle: "Вид кнопки",
        style_text: "Текст",
        style_icon: "Значок",
        style_both: "Значок и текст",
        set_readOnLeave: "Отмечать сервер прочитанным при переходе на другой",
        set_activeFrom: "Автоматическое чтение с",
        set_activeTo: "Автоматическое чтение до",
        note_activeHours: "Действует для интервала, заглушённых серверов и запуска. Одинаковый час или «В любое время» означает всегда.",
        hours_any: "В любое время",
        set_clearHotkey: "Сочетание клавиш для очистки упоминаний",
        context_clear_all: "Все упоминания",
        context_clear_server: "Упоминания с этого сервера",
        context_clear_old: "Упоминания старше одного дня",
        settings_stats: "Статистика",
        stats_text: "Отмечено прочитанным: серверов {servers}, личных сообщений {dms} · Удалено упоминаний: {mentions}",
        button_reset: "Сбросить",
        toast_noMentions: "Нет подходящих упоминаний",
    },
    "sv-SE": {
        context_unreadguilds: "Olästa servrar",
        context_pingedguilds: "Servrar med omnämnanden",
        context_mutedguilds: "Tystade servrar",
        context_guilds: "Alla servrar",
        context_dms: "Direktmeddelanden",
        context_current: "Nuvarande server",
        context_others: "Alla servrar utom den nuvarande",
        context_folders: "Mappar",
        context_alldms: "Alla olästa direktmeddelanden",
        modal_title: "Bekräfta",
        modal_confirmnotifications: "Vill du verkligen markera alla olästa aviseringar som lästa?",
        modal_confirmmentions: "Vill du verkligen ta bort alla omnämnanden från listan?",
        tooltip_clear: "Stäng (alla)",
        tooltip_button: "Oläst: {servers} servrar · {dms} DM\nShift+klick markerar allt som läst",
        toast_alreadyclearing: "Omnämnanden tas redan bort, vänta",
        toast_clearing: "Tar bort {n} omnämnanden, det tar ungefär {n} sekunder",
        toast_cleared: "Alla senaste omnämnanden har tagits bort",
        toast_read: "Markerat som läst · Servrar: {servers} · DM: {dms}",
        toast_nothing: "Inget var oläst",
        settings_general: "Inställningar",
        settings_batch: "Vänsterklick markerar följande som läst",
        settings_extras: "Extra",
        settings_blacklist: "Svartlista för servrar",
        set_addClearButton: "Lägger till en knapp i omnämnandefönstret som tar bort alla omnämnanden",
        set_guilds: "Olästa servrar",
        set_muted: "Tystade servrar",
        set_dms: "Direktmeddelanden med omnämnanden",
        set_label: "Knapptext",
        set_hideWhenEmpty: "Döljer knappen så länge inget är oläst",
        set_toast: "Visar hur mycket som markerades som läst",
        set_autoMuted: "Markerar tystade servrar automatiskt som lästa",
        note_autoMuted: "Nya meddelanden på tystade servrar markeras som lästa efter 5 sekunder. Svartlistan gäller.",
        set_readOnStart: "Markerar allt som läst när Discord startar (som vänsterklick)",
        set_hotkey: "Kortkommando",
        note_hotkey: "Gör samma sak som ett vänsterklick på knappen.",
        blacklist_note: "Grå servrar markeras aldrig som lästa. Klicka på en server för att växla.",
        blacklist_enable: "Aktivera för alla servrar",
        blacklist_disable: "Inaktivera för alla servrar",
        button_enable: "Aktivera",
        button_disable: "Inaktivera",
        set_language: "Språk",
        note_language: "Gäller direkt. Öppna inställningarna igen för att se dem på det nya språket.",
        language_auto: "Automatiskt (Discords språk)",
        set_badgeMode: "Räknare på knappen",
        badge_mentions: "Omnämnanden",
        badge_unread: "Olästa servrar och DM",
        badge_off: "Av",
        set_interval: "Markera automatiskt som läst var",
        interval_off: "Aldrig",
        interval_minutes: "{n} minut",
        context_blacklist: "Undanta från read all",
        tooltip_middle: "Mittenklick markerar bara den nuvarande servern som läst",
        set_olderThan: "Markera bara meddelanden som lästa som är äldre än",
        note_olderThan: "Nyare meddelanden förblir olästa. Kanaler med omnämnanden förblir alltid olästa i det här läget.",
        olderThan_off: "Alla meddelanden",
        olderThan_hours: "{n} tim",
        set_keepMentions: "Låt kanaler med omnämnanden förbli olästa",
        channels_excluded: "Undantagna kanaler (högerklicka på en kanal för att lägga till)",
        channels_none: "Inga",
        button_clear: "Ta bort alla",
        tooltip_more: "+{n} till",
        set_confirm: "Fråga innan markering eller rensning",
        confirm_never: "Aldrig",
        confirm_always: "Alltid",
        confirm_from: "Från {n} åt gången",
        set_clearMarksRead: "Rensning av omnämnanden markerar även deras kanaler som lästa",
        set_checkUpdates: "Sök efter uppdateringar",
        note_checkUpdates: "Söker efter en ny version på GitHub och erbjuder installation med ett klick.",
        notice_update: "ReadAllNotificationsButtonv2 {version} finns tillgänglig.",
        button_update: "Uppdatera",
        toast_updated: "Uppdaterad till {version}",
        toast_updateFailed: "Uppdateringen misslyckades: {error}",
        set_buttonStyle: "Knappens stil",
        style_text: "Text",
        style_icon: "Ikon",
        style_both: "Ikon och text",
        set_readOnLeave: "Markera en server som läst när du byter till en annan",
        set_activeFrom: "Automatisk läsning från",
        set_activeTo: "Automatisk läsning till",
        note_activeHours: "Gäller intervallet, tystade servrar och uppstarten. Samma timme eller ”När som helst” betyder alltid.",
        hours_any: "När som helst",
        set_clearHotkey: "Kortkommando för att rensa omnämnanden",
        context_clear_all: "Alla omnämnanden",
        context_clear_server: "Omnämnanden från den här servern",
        context_clear_old: "Omnämnanden äldre än en dag",
        settings_stats: "Statistik",
        stats_text: "Markerade som lästa: {servers} servrar, {dms} direktmeddelanden · Rensade omnämnanden: {mentions}",
        button_reset: "Återställ",
        toast_noMentions: "Inga matchande omnämnanden",
    },
    th: {
        context_unreadguilds: "เซิร์ฟเวอร์ที่ยังไม่ได้อ่าน",
        context_pingedguilds: "เซิร์ฟเวอร์ที่มีการกล่าวถึง",
        context_mutedguilds: "เซิร์ฟเวอร์ที่ปิดเสียง",
        context_guilds: "เซิร์ฟเวอร์ทั้งหมด",
        context_dms: "ข้อความส่วนตัว",
        context_current: "เซิร์ฟเวอร์ปัจจุบัน",
        context_others: "ทุกเซิร์ฟเวอร์ยกเว้นเซิร์ฟเวอร์ปัจจุบัน",
        context_folders: "โฟลเดอร์",
        context_alldms: "ข้อความส่วนตัวที่ยังไม่ได้อ่านทั้งหมด",
        modal_title: "ยืนยัน",
        modal_confirmnotifications: "ต้องการทำเครื่องหมายการแจ้งเตือนที่ยังไม่ได้อ่านทั้งหมดว่าอ่านแล้วใช่ไหม",
        modal_confirmmentions: "ต้องการลบการกล่าวถึงทั้งหมดออกจากรายการใช่ไหม",
        tooltip_clear: "ปิด (ทั้งหมด)",
        tooltip_button: "ยังไม่ได้อ่าน: เซิร์ฟเวอร์ {servers} · DM {dms}\nShift+คลิกเพื่อทำเครื่องหมายว่าอ่านทั้งหมด",
        toast_alreadyclearing: "กำลังลบการกล่าวถึงอยู่ โปรดรอ",
        toast_clearing: "กำลังลบการกล่าวถึง ({n}) ใช้เวลาประมาณ {n} วินาที",
        toast_cleared: "ลบการกล่าวถึงล่าสุดทั้งหมดแล้ว",
        toast_read: "ทำเครื่องหมายว่าอ่านแล้ว · เซิร์ฟเวอร์: {servers} · DM: {dms}",
        toast_nothing: "ไม่มีรายการที่ยังไม่ได้อ่าน",
        settings_general: "การตั้งค่า",
        settings_batch: "คลิกซ้ายจะทำเครื่องหมายว่าอ่านแล้ว",
        settings_extras: "ฟีเจอร์เพิ่มเติม",
        settings_blacklist: "บัญชีดำเซิร์ฟเวอร์",
        set_addClearButton: "เพิ่มปุ่มในหน้าต่างการกล่าวถึงเพื่อลบการกล่าวถึงทั้งหมด",
        set_guilds: "เซิร์ฟเวอร์ที่ยังไม่ได้อ่าน",
        set_muted: "เซิร์ฟเวอร์ที่ปิดเสียง",
        set_dms: "ข้อความส่วนตัวที่มีการกล่าวถึง",
        set_label: "ข้อความบนปุ่ม",
        set_hideWhenEmpty: "ซ่อนปุ่มเมื่อไม่มีรายการที่ยังไม่ได้อ่าน",
        set_toast: "แสดงจำนวนที่ทำเครื่องหมายว่าอ่านแล้ว",
        set_autoMuted: "ทำเครื่องหมายเซิร์ฟเวอร์ที่ปิดเสียงว่าอ่านแล้วโดยอัตโนมัติ",
        note_autoMuted: "ข้อความใหม่ในเซิร์ฟเวอร์ที่ปิดเสียงจะถูกทำเครื่องหมายว่าอ่านแล้วหลัง 5 วินาที โดยใช้บัญชีดำด้วย",
        set_readOnStart: "ทำเครื่องหมายว่าอ่านทั้งหมดเมื่อเปิด Discord (เหมือนคลิกซ้าย)",
        set_hotkey: "ปุ่มลัด",
        note_hotkey: "ทำงานเหมือนคลิกซ้ายที่ปุ่ม",
        blacklist_note: "เซิร์ฟเวอร์สีเทาจะไม่ถูกทำเครื่องหมายว่าอ่านแล้ว คลิกที่เซิร์ฟเวอร์เพื่อสลับ",
        blacklist_enable: "เปิดสำหรับทุกเซิร์ฟเวอร์",
        blacklist_disable: "ปิดสำหรับทุกเซิร์ฟเวอร์",
        button_enable: "เปิด",
        button_disable: "ปิด",
        set_language: "ภาษา",
        note_language: "มีผลทันที เปิดการตั้งค่าใหม่เพื่อดูในภาษาใหม่",
        language_auto: "อัตโนมัติ (ภาษาของ Discord)",
        set_badgeMode: "ตัวนับบนปุ่ม",
        badge_mentions: "การกล่าวถึง",
        badge_unread: "เซิร์ฟเวอร์และ DM ที่ยังไม่ได้อ่าน",
        badge_off: "ปิด",
        set_interval: "ทำเครื่องหมายว่าอ่านแล้วอัตโนมัติทุก",
        interval_off: "ไม่เลย",
        interval_minutes: "{n} นาที",
        context_blacklist: "ไม่รวมใน read all",
        tooltip_middle: "คลิกกลางจะทำเครื่องหมายว่าอ่านแล้วเฉพาะเซิร์ฟเวอร์ปัจจุบัน",
        set_olderThan: "ทำเครื่องหมายว่าอ่านแล้วเฉพาะข้อความที่เก่ากว่า",
        note_olderThan: "ข้อความที่ใหม่กว่าจะยังไม่ได้อ่าน ในโหมดนี้ช่องที่มีการกล่าวถึงจะยังไม่ได้อ่านเสมอ",
        olderThan_off: "ข้อความทั้งหมด",
        olderThan_hours: "{n} ชม.",
        set_keepMentions: "ให้ช่องที่มีการกล่าวถึงยังไม่ได้อ่าน",
        channels_excluded: "ช่องที่ไม่รวม (คลิกขวาที่ช่องเพื่อเพิ่ม)",
        channels_none: "ไม่มี",
        button_clear: "ลบทั้งหมด",
        tooltip_more: "+อีก {n}",
        set_confirm: "ถามก่อนทำเครื่องหมายหรือล้าง",
        confirm_never: "ไม่ถาม",
        confirm_always: "ถามทุกครั้ง",
        confirm_from: "เมื่อมีตั้งแต่ {n} รายการพร้อมกัน",
        set_clearMarksRead: "การล้างการกล่าวถึงจะทำเครื่องหมายช่องของรายการนั้นว่าอ่านแล้วด้วย",
        set_checkUpdates: "ตรวจหาอัปเดต",
        note_checkUpdates: "ค้นหาเวอร์ชันใหม่บน GitHub และเสนอให้ติดตั้งด้วยการคลิกเดียว",
        notice_update: "ReadAllNotificationsButtonv2 {version} พร้อมใช้งานแล้ว",
        button_update: "อัปเดต",
        toast_updated: "อัปเดตเป็น {version} แล้ว",
        toast_updateFailed: "อัปเดตไม่สำเร็จ: {error}",
        set_buttonStyle: "รูปแบบปุ่ม",
        style_text: "ข้อความ",
        style_icon: "ไอคอน",
        style_both: "ไอคอนและข้อความ",
        set_readOnLeave: "ทำเครื่องหมายเซิร์ฟเวอร์ว่าอ่านแล้วเมื่อสลับไปเซิร์ฟเวอร์อื่น",
        set_activeFrom: "อ่านอัตโนมัติตั้งแต่",
        set_activeTo: "อ่านอัตโนมัติจนถึง",
        note_activeHours: "ใช้กับช่วงเวลา เซิร์ฟเวอร์ที่ปิดเสียง และตอนเริ่มต้น ชั่วโมงเดียวกันหรือ \"เวลาใดก็ได้\" หมายถึงตลอดเวลา",
        hours_any: "เวลาใดก็ได้",
        set_clearHotkey: "ปุ่มลัดสำหรับล้างการกล่าวถึง",
        context_clear_all: "การกล่าวถึงทั้งหมด",
        context_clear_server: "การกล่าวถึงจากเซิร์ฟเวอร์นี้",
        context_clear_old: "การกล่าวถึงที่เก่ากว่าหนึ่งวัน",
        settings_stats: "สถิติ",
        stats_text: "ทำเครื่องหมายว่าอ่านแล้ว: {servers} เซิร์ฟเวอร์, {dms} ข้อความส่วนตัว · ล้างการกล่าวถึง: {mentions}",
        button_reset: "รีเซ็ต",
        toast_noMentions: "ไม่มีการกล่าวถึงที่ตรงกัน",
    },
    tr: {
        context_unreadguilds: "Okunmamış Sunucular",
        context_pingedguilds: "Bahsedilen Sunucular",
        context_mutedguilds: "Sessize Alınan Sunucular",
        context_guilds: "Tüm Sunucular",
        context_dms: "Doğrudan Mesajlar",
        context_current: "Geçerli Sunucu",
        context_others: "Geçerli sunucu hariç tüm sunucular",
        context_folders: "Klasörler",
        context_alldms: "Tüm okunmamış doğrudan mesajlar",
        modal_title: "Onayla",
        modal_confirmnotifications: "Tüm okunmamış bildirimleri okundu olarak işaretlemek istediğine emin misin?",
        modal_confirmmentions: "Tüm bahsetmeleri listeden kaldırmak istediğine emin misin?",
        tooltip_clear: "Kapat (tümü)",
        tooltip_button: "Okunmamış: sunucular {servers} · DM {dms}\nShift+tık her şeyi okundu işaretler",
        toast_alreadyclearing: "Bahsetmeler zaten kaldırılıyor, lütfen bekle",
        toast_clearing: "Bahsetmeler kaldırılıyor ({n}), yaklaşık {n} saniye sürer",
        toast_cleared: "Tüm son bahsetmeler kaldırıldı",
        toast_read: "Okundu olarak işaretlendi · Sunucular: {servers} · DM: {dms}",
        toast_nothing: "Okunmamış bir şey yoktu",
        settings_general: "Ayarlar",
        settings_batch: "Sol tık şunları okundu işaretler",
        settings_extras: "Ekstralar",
        settings_blacklist: "Sunucu kara listesi",
        set_addClearButton: "Bahsetmeler penceresine tüm bahsetmeleri kaldıran bir düğme ekler",
        set_guilds: "Okunmamış sunucular",
        set_muted: "Sessize alınan sunucular",
        set_dms: "Bahsetme içeren doğrudan mesajlar",
        set_label: "Düğme metni",
        set_hideWhenEmpty: "Okunmamış bir şey yokken düğmeyi gizler",
        set_toast: "Ne kadarının okundu işaretlendiğini gösterir",
        set_autoMuted: "Sessize alınan sunucuları otomatik olarak okundu işaretler",
        note_autoMuted: "Sessize alınan sunuculardaki yeni mesajlar 5 saniye sonra okundu işaretlenir. Kara liste geçerlidir.",
        set_readOnStart: "Discord başlarken her şeyi okundu işaretler (sol tık gibi)",
        set_hotkey: "Klavye kısayolu",
        note_hotkey: "Düğmeye sol tıklamakla aynı işi yapar.",
        blacklist_note: "Gri sunucular asla okundu işaretlenmez. Değiştirmek için bir sunucuya tıkla.",
        blacklist_enable: "Tüm sunucular için etkinleştir",
        blacklist_disable: "Tüm sunucular için devre dışı bırak",
        button_enable: "Etkinleştir",
        button_disable: "Devre dışı bırak",
        set_language: "Dil",
        note_language: "Hemen geçerli olur. Yeni dilde görmek için ayarları yeniden aç.",
        language_auto: "Otomatik (Discord dili)",
        set_badgeMode: "Düğmedeki sayaç",
        badge_mentions: "Bahsetmeler",
        badge_unread: "Okunmamış sunucular ve DM'ler",
        badge_off: "Kapalı",
        set_interval: "Otomatik okundu işaretleme sıklığı",
        interval_off: "Asla",
        interval_minutes: "{n} dakika",
        context_blacklist: "read all dışında tut",
        tooltip_middle: "Orta tık yalnızca geçerli sunucuyu okundu işaretler",
        set_olderThan: "Yalnızca şundan eski mesajları okundu işaretle",
        note_olderThan: "Daha yeni mesajlar okunmamış kalır. Bu modda bahsetme içeren kanallar her zaman okunmamış kalır.",
        olderThan_off: "Tüm mesajlar",
        olderThan_hours: "{n} sa",
        set_keepMentions: "Bahsetme içeren kanalları okunmamış bırak",
        channels_excluded: "Hariç tutulan kanallar (eklemek için bir kanala sağ tıkla)",
        channels_none: "Yok",
        button_clear: "Tümünü kaldır",
        tooltip_more: "+{n} daha",
        set_confirm: "İşaretlemeden veya temizlemeden önce sor",
        confirm_never: "Asla",
        confirm_always: "Her zaman",
        confirm_from: "Tek seferde {n} veya daha fazlaysa",
        set_clearMarksRead: "Bahsetmeleri temizlemek kanallarını da okundu olarak işaretler",
        set_checkUpdates: "Güncellemeleri denetle",
        note_checkUpdates: "GitHub'da yeni sürüm arar ve tek tıkla yüklemeyi önerir.",
        notice_update: "ReadAllNotificationsButtonv2 {version} kullanılabilir.",
        button_update: "Güncelle",
        toast_updated: "{version} sürümüne güncellendi",
        toast_updateFailed: "Güncelleme başarısız: {error}",
        set_buttonStyle: "Düğme stili",
        style_text: "Metin",
        style_icon: "Simge",
        style_both: "Simge ve metin",
        set_readOnLeave: "Başka bir sunucuya geçtiğinde sunucuyu okundu olarak işaretle",
        set_activeFrom: "Otomatik okuma başlangıcı",
        set_activeTo: "Otomatik okuma bitişi",
        note_activeHours: "Aralık, sessize alınan sunucular ve başlangıç için geçerlidir. Aynı saat veya \"Herhangi bir saat\" her zaman demektir.",
        hours_any: "Herhangi bir saat",
        set_clearHotkey: "Bahsetmeleri temizleme kısayolu",
        context_clear_all: "Tüm bahsetmeler",
        context_clear_server: "Bu sunucudaki bahsetmeler",
        context_clear_old: "Bir günden eski bahsetmeler",
        settings_stats: "İstatistikler",
        stats_text: "Okundu olarak işaretlenen: {servers} sunucu, {dms} doğrudan mesaj · Temizlenen bahsetmeler: {mentions}",
        button_reset: "Sıfırla",
        toast_noMentions: "Eşleşen bahsetme yok",
    },
    uk: {
        context_unreadguilds: "Непрочитані сервери",
        context_pingedguilds: "Сервери зі згадками",
        context_mutedguilds: "Приглушені сервери",
        context_guilds: "Усі сервери",
        context_dms: "Особисті повідомлення",
        context_current: "Поточний сервер",
        context_others: "Усі сервери, крім поточного",
        context_folders: "Теки",
        context_alldms: "Усі непрочитані особисті повідомлення",
        modal_title: "Підтвердження",
        modal_confirmnotifications: "Позначити всі непрочитані сповіщення як прочитані?",
        modal_confirmmentions: "Видалити всі згадки зі списку?",
        tooltip_clear: "Закрити (усі)",
        tooltip_button: "Непрочитано: сервери {servers} · ОП {dms}\nShift+клік позначає все як прочитане",
        toast_alreadyclearing: "Згадки вже видаляються, зачекайте",
        toast_clearing: "Видалення згадок ({n}), триватиме близько {n} с",
        toast_cleared: "Усі останні згадки видалено",
        toast_read: "Позначено як прочитане · Сервери: {servers} · ОП: {dms}",
        toast_nothing: "Непрочитаного не було",
        settings_general: "Налаштування",
        settings_batch: "Лівий клік позначає як прочитане",
        settings_extras: "Додатково",
        settings_blacklist: "Чорний список серверів",
        set_addClearButton: "Додає у вікно згадок кнопку, що видаляє всі згадки",
        set_guilds: "Непрочитані сервери",
        set_muted: "Приглушені сервери",
        set_dms: "Особисті повідомлення зі згадками",
        set_label: "Текст кнопки",
        set_hideWhenEmpty: "Приховувати кнопку, поки немає непрочитаного",
        set_toast: "Показувати, скільки позначено як прочитане",
        set_autoMuted: "Автоматично позначати приглушені сервери як прочитані",
        note_autoMuted: "Нові повідомлення на приглушених серверах позначаються як прочитані через 5 секунд. Чорний список враховується.",
        set_readOnStart: "Позначати все як прочитане під час запуску Discord (як лівий клік)",
        set_hotkey: "Комбінація клавіш",
        note_hotkey: "Робить те саме, що лівий клік по кнопці.",
        blacklist_note: "Сірі сервери ніколи не позначаються як прочитані. Натисніть на сервер, щоб перемкнути.",
        blacklist_enable: "Увімкнути для всіх серверів",
        blacklist_disable: "Вимкнути для всіх серверів",
        button_enable: "Увімкнути",
        button_disable: "Вимкнути",
        set_language: "Мова",
        note_language: "Діє одразу. Відкрийте налаштування знову, щоб побачити їх новою мовою.",
        language_auto: "Автоматично (мова Discord)",
        set_badgeMode: "Лічильник на кнопці",
        badge_mentions: "Згадки",
        badge_unread: "Непрочитані сервери та ОП",
        badge_off: "Вимкнено",
        set_interval: "Автоматично позначати як прочитане кожні",
        interval_off: "Ніколи",
        interval_minutes: "{n} хв",
        context_blacklist: "Виключити з read all",
        tooltip_middle: "Середній клік позначає як прочитаний лише поточний сервер",
        set_olderThan: "Позначати прочитаними лише повідомлення, старші за",
        note_olderThan: "Новіші повідомлення залишаються непрочитаними. У цьому режимі канали зі згадками завжди залишаються непрочитаними.",
        olderThan_off: "Усі повідомлення",
        olderThan_hours: "{n} год",
        set_keepMentions: "Залишати канали зі згадками непрочитаними",
        channels_excluded: "Виключені канали (правий клік по каналу, щоб додати)",
        channels_none: "Немає",
        button_clear: "Видалити всі",
        tooltip_more: "+{n} ще",
        set_confirm: "Питати перед позначенням або очищенням",
        confirm_never: "Ніколи",
        confirm_always: "Завжди",
        confirm_from: "Від {n} за раз",
        set_clearMarksRead: "Очищення згадок також позначає їхні канали прочитаними",
        set_checkUpdates: "Перевіряти оновлення",
        note_checkUpdates: "Шукає нову версію на GitHub і пропонує встановити її одним клацанням.",
        notice_update: "Доступна версія ReadAllNotificationsButtonv2 {version}.",
        button_update: "Оновити",
        toast_updated: "Оновлено до {version}",
        toast_updateFailed: "Не вдалося оновити: {error}",
        set_buttonStyle: "Вигляд кнопки",
        style_text: "Текст",
        style_icon: "Значок",
        style_both: "Значок і текст",
        set_readOnLeave: "Позначати сервер прочитаним під час переходу на інший",
        set_activeFrom: "Автоматичне читання з",
        set_activeTo: "Автоматичне читання до",
        note_activeHours: "Діє для інтервалу, приглушених серверів і запуску. Однакова година або «Будь-коли» означає завжди.",
        hours_any: "Будь-коли",
        set_clearHotkey: "Комбінація клавіш для очищення згадок",
        context_clear_all: "Усі згадки",
        context_clear_server: "Згадки з цього сервера",
        context_clear_old: "Згадки, старші за один день",
        settings_stats: "Статистика",
        stats_text: "Позначено прочитаним: серверів {servers}, особистих повідомлень {dms} · Видалено згадок: {mentions}",
        button_reset: "Скинути",
        toast_noMentions: "Немає відповідних згадок",
    },
    vi: {
        context_unreadguilds: "Máy chủ chưa đọc",
        context_pingedguilds: "Máy chủ có lượt nhắc",
        context_mutedguilds: "Máy chủ đã tắt tiếng",
        context_guilds: "Tất cả máy chủ",
        context_dms: "Tin nhắn trực tiếp",
        context_current: "Máy chủ hiện tại",
        context_others: "Tất cả máy chủ trừ máy chủ hiện tại",
        context_folders: "Thư mục",
        context_alldms: "Tất cả tin nhắn trực tiếp chưa đọc",
        modal_title: "Xác nhận",
        modal_confirmnotifications: "Bạn có chắc muốn đánh dấu tất cả thông báo chưa đọc là đã đọc?",
        modal_confirmmentions: "Bạn có chắc muốn xóa tất cả lượt nhắc khỏi danh sách?",
        tooltip_clear: "Đóng (tất cả)",
        tooltip_button: "Chưa đọc: máy chủ {servers} · DM {dms}\nShift+nhấp để đánh dấu tất cả đã đọc",
        toast_alreadyclearing: "Đang xóa lượt nhắc, vui lòng chờ",
        toast_clearing: "Đang xóa lượt nhắc ({n}), mất khoảng {n} giây",
        toast_cleared: "Đã xóa tất cả lượt nhắc gần đây",
        toast_read: "Đã đánh dấu đã đọc · Máy chủ: {servers} · DM: {dms}",
        toast_nothing: "Không có gì chưa đọc",
        settings_general: "Cài đặt",
        settings_batch: "Nhấp chuột trái đánh dấu đã đọc",
        settings_extras: "Tiện ích thêm",
        settings_blacklist: "Danh sách đen máy chủ",
        set_addClearButton: "Thêm nút vào cửa sổ lượt nhắc để xóa tất cả lượt nhắc",
        set_guilds: "Máy chủ chưa đọc",
        set_muted: "Máy chủ đã tắt tiếng",
        set_dms: "Tin nhắn trực tiếp có lượt nhắc",
        set_label: "Chữ trên nút",
        set_hideWhenEmpty: "Ẩn nút khi không có gì chưa đọc",
        set_toast: "Hiển thị số lượng đã đánh dấu đã đọc",
        set_autoMuted: "Tự động đánh dấu máy chủ đã tắt tiếng là đã đọc",
        note_autoMuted: "Tin nhắn mới trong máy chủ đã tắt tiếng được đánh dấu đã đọc sau 5 giây. Áp dụng danh sách đen.",
        set_readOnStart: "Đánh dấu tất cả đã đọc khi khởi động Discord (như nhấp chuột trái)",
        set_hotkey: "Phím tắt",
        note_hotkey: "Giống như nhấp chuột trái vào nút.",
        blacklist_note: "Máy chủ màu xám không bao giờ được đánh dấu đã đọc. Nhấp vào máy chủ để chuyển đổi.",
        blacklist_enable: "Bật cho tất cả máy chủ",
        blacklist_disable: "Tắt cho tất cả máy chủ",
        button_enable: "Bật",
        button_disable: "Tắt",
        set_language: "Ngôn ngữ",
        note_language: "Áp dụng ngay. Mở lại cài đặt để xem bằng ngôn ngữ mới.",
        language_auto: "Tự động (ngôn ngữ của Discord)",
        set_badgeMode: "Bộ đếm trên nút",
        badge_mentions: "Lượt nhắc",
        badge_unread: "Máy chủ và DM chưa đọc",
        badge_off: "Tắt",
        set_interval: "Tự động đánh dấu đã đọc mỗi",
        interval_off: "Không bao giờ",
        interval_minutes: "{n} phút",
        context_blacklist: "Loại khỏi read all",
        tooltip_middle: "Nhấp chuột giữa chỉ đánh dấu máy chủ hiện tại là đã đọc",
        set_olderThan: "Chỉ đánh dấu đã đọc các tin nhắn cũ hơn",
        note_olderThan: "Tin nhắn mới hơn vẫn chưa đọc. Ở chế độ này, kênh có lượt nhắc luôn giữ trạng thái chưa đọc.",
        olderThan_off: "Tất cả tin nhắn",
        olderThan_hours: "{n} giờ",
        set_keepMentions: "Giữ kênh có lượt nhắc ở trạng thái chưa đọc",
        channels_excluded: "Kênh đã loại trừ (nhấp chuột phải vào kênh để thêm)",
        channels_none: "Không có",
        button_clear: "Xóa tất cả",
        tooltip_more: "+{n} khác",
        set_confirm: "Hỏi trước khi đánh dấu hoặc xóa",
        confirm_never: "Không bao giờ",
        confirm_always: "Luôn luôn",
        confirm_from: "Từ {n} mục trở lên cùng lúc",
        set_clearMarksRead: "Xóa lượt nhắc cũng đánh dấu kênh của chúng là đã đọc",
        set_checkUpdates: "Kiểm tra cập nhật",
        note_checkUpdates: "Tìm phiên bản mới trên GitHub và đề nghị cài đặt chỉ với một cú nhấp.",
        notice_update: "ReadAllNotificationsButtonv2 {version} đã có.",
        button_update: "Cập nhật",
        toast_updated: "Đã cập nhật lên {version}",
        toast_updateFailed: "Cập nhật thất bại: {error}",
        set_buttonStyle: "Kiểu nút",
        style_text: "Văn bản",
        style_icon: "Biểu tượng",
        style_both: "Biểu tượng và văn bản",
        set_readOnLeave: "Đánh dấu máy chủ là đã đọc khi chuyển sang máy chủ khác",
        set_activeFrom: "Tự động đọc từ",
        set_activeTo: "Tự động đọc đến",
        note_activeHours: "Áp dụng cho khoảng thời gian, máy chủ đã tắt tiếng và lúc khởi động. Cùng giờ hoặc \"Bất kỳ lúc nào\" nghĩa là luôn luôn.",
        hours_any: "Bất kỳ lúc nào",
        set_clearHotkey: "Phím tắt để xóa lượt nhắc",
        context_clear_all: "Tất cả lượt nhắc",
        context_clear_server: "Lượt nhắc từ máy chủ này",
        context_clear_old: "Lượt nhắc cũ hơn một ngày",
        settings_stats: "Thống kê",
        stats_text: "Đã đánh dấu đã đọc: {servers} máy chủ, {dms} tin nhắn trực tiếp · Đã xóa lượt nhắc: {mentions}",
        button_reset: "Đặt lại",
        toast_noMentions: "Không có lượt nhắc phù hợp",
    },
    "zh-CN": {
        context_unreadguilds: "未读服务器",
        context_pingedguilds: "有提及的服务器",
        context_mutedguilds: "已静音的服务器",
        context_guilds: "所有服务器",
        context_dms: "私信",
        context_current: "当前服务器",
        context_others: "除当前服务器外的所有服务器",
        context_folders: "文件夹",
        context_alldms: "所有未读私信",
        modal_title: "确认",
        modal_confirmnotifications: "确定要将所有未读通知标记为已读吗？",
        modal_confirmmentions: "确定要从列表中移除所有提及吗？",
        tooltip_clear: "关闭（全部）",
        tooltip_button: "未读：服务器 {servers} · 私信 {dms}\nShift+点击将全部标记为已读",
        toast_alreadyclearing: "正在移除提及，请稍候",
        toast_clearing: "正在移除提及（{n}），约需 {n} 秒",
        toast_cleared: "已移除所有最近的提及",
        toast_read: "已标记为已读 · 服务器：{servers} · 私信：{dms}",
        toast_nothing: "没有未读内容",
        settings_general: "设置",
        settings_batch: "左键点击时标记为已读的内容",
        settings_extras: "附加功能",
        settings_blacklist: "服务器黑名单",
        set_addClearButton: "在提及窗口中添加一个移除所有提及的按钮",
        set_guilds: "未读服务器",
        set_muted: "已静音的服务器",
        set_dms: "有提及的私信",
        set_label: "按钮文字",
        set_hideWhenEmpty: "没有未读内容时隐藏按钮",
        set_toast: "显示已标记为已读的数量",
        set_autoMuted: "自动将已静音的服务器标记为已读",
        note_autoMuted: "已静音服务器中的新消息会在 5 秒后标记为已读。黑名单同样适用。",
        set_readOnStart: "Discord 启动时将全部标记为已读（与左键点击相同）",
        set_hotkey: "快捷键",
        note_hotkey: "与左键点击按钮效果相同。",
        blacklist_note: "灰色的服务器不会被标记为已读。点击服务器即可切换。",
        blacklist_enable: "为所有服务器启用",
        blacklist_disable: "为所有服务器停用",
        button_enable: "启用",
        button_disable: "停用",
        set_language: "语言",
        note_language: "立即生效。重新打开设置即可看到新语言。",
        language_auto: "自动（Discord 语言）",
        set_badgeMode: "按钮上的计数",
        badge_mentions: "提及",
        badge_unread: "未读服务器和私信",
        badge_off: "关闭",
        set_interval: "自动标记为已读的间隔",
        interval_off: "从不",
        interval_minutes: "{n} 分钟",
        context_blacklist: "不参与 read all",
        tooltip_middle: "中键点击只将当前服务器标记为已读",
        set_olderThan: "只将早于以下时间的消息标记为已读",
        note_olderThan: "较新的消息保持未读。在此模式下，有提及的频道始终保持未读。",
        olderThan_off: "所有消息",
        olderThan_hours: "{n} 小时",
        set_keepMentions: "有提及的频道保持未读",
        channels_excluded: "已排除的频道（右键点击频道即可添加）",
        channels_none: "无",
        button_clear: "全部移除",
        tooltip_more: "另有 {n} 个",
        set_confirm: "标记或清除前询问",
        confirm_never: "从不",
        confirm_always: "总是",
        confirm_from: "一次 {n} 个及以上时",
        set_clearMarksRead: "清除提及时也将其频道标记为已读",
        set_checkUpdates: "检查更新",
        note_checkUpdates: "在 GitHub 上查找新版本，并提供一键安装。",
        notice_update: "ReadAllNotificationsButtonv2 {version} 已可用。",
        button_update: "更新",
        toast_updated: "已更新到 {version}",
        toast_updateFailed: "更新失败：{error}",
        set_buttonStyle: "按钮样式",
        style_text: "文字",
        style_icon: "图标",
        style_both: "图标和文字",
        set_readOnLeave: "切换到其他服务器时将其标记为已读",
        set_activeFrom: "自动已读开始时间",
        set_activeTo: "自动已读结束时间",
        note_activeHours: "适用于定时、已静音的服务器和启动时。相同的小时或“任意时间”表示始终生效。",
        hours_any: "任意时间",
        set_clearHotkey: "清除提及的快捷键",
        context_clear_all: "所有提及",
        context_clear_server: "此服务器的提及",
        context_clear_old: "超过一天的提及",
        settings_stats: "统计",
        stats_text: "已标记为已读：{servers} 个服务器，{dms} 个私信 · 已清除提及：{mentions}",
        button_reset: "重置",
        toast_noMentions: "没有匹配的提及",
    },
    "zh-TW": {
        context_unreadguilds: "未讀伺服器",
        context_pingedguilds: "有提及的伺服器",
        context_mutedguilds: "已靜音的伺服器",
        context_guilds: "所有伺服器",
        context_dms: "私人訊息",
        context_current: "目前的伺服器",
        context_others: "除目前伺服器外的所有伺服器",
        context_folders: "資料夾",
        context_alldms: "所有未讀私人訊息",
        modal_title: "確認",
        modal_confirmnotifications: "確定要將所有未讀通知標示為已讀嗎？",
        modal_confirmmentions: "確定要從清單中移除所有提及嗎？",
        tooltip_clear: "關閉（全部）",
        tooltip_button: "未讀：伺服器 {servers} · 私訊 {dms}\nShift+點擊將全部標示為已讀",
        toast_alreadyclearing: "正在移除提及，請稍候",
        toast_clearing: "正在移除提及（{n}），約需 {n} 秒",
        toast_cleared: "已移除所有最近的提及",
        toast_read: "已標示為已讀 · 伺服器：{servers} · 私訊：{dms}",
        toast_nothing: "沒有未讀內容",
        settings_general: "設定",
        settings_batch: "左鍵點擊時標示為已讀的內容",
        settings_extras: "附加功能",
        settings_blacklist: "伺服器黑名單",
        set_addClearButton: "在提及視窗中加入一個移除所有提及的按鈕",
        set_guilds: "未讀伺服器",
        set_muted: "已靜音的伺服器",
        set_dms: "有提及的私人訊息",
        set_label: "按鈕文字",
        set_hideWhenEmpty: "沒有未讀內容時隱藏按鈕",
        set_toast: "顯示已標示為已讀的數量",
        set_autoMuted: "自動將已靜音的伺服器標示為已讀",
        note_autoMuted: "已靜音伺服器中的新訊息會在 5 秒後標示為已讀。黑名單同樣適用。",
        set_readOnStart: "Discord 啟動時將全部標示為已讀（與左鍵點擊相同）",
        set_hotkey: "快速鍵",
        note_hotkey: "與左鍵點擊按鈕效果相同。",
        blacklist_note: "灰色的伺服器不會被標示為已讀。點擊伺服器即可切換。",
        blacklist_enable: "為所有伺服器啟用",
        blacklist_disable: "為所有伺服器停用",
        button_enable: "啟用",
        button_disable: "停用",
        set_language: "語言",
        note_language: "立即生效。重新開啟設定即可看到新語言。",
        language_auto: "自動（Discord 語言）",
        set_badgeMode: "按鈕上的計數",
        badge_mentions: "提及",
        badge_unread: "未讀伺服器和私訊",
        badge_off: "關閉",
        set_interval: "自動標示為已讀的間隔",
        interval_off: "從不",
        interval_minutes: "{n} 分鐘",
        context_blacklist: "不參與 read all",
        tooltip_middle: "中鍵點擊只將目前的伺服器標示為已讀",
        set_olderThan: "只將早於以下時間的訊息標示為已讀",
        note_olderThan: "較新的訊息保持未讀。在此模式下，有提及的頻道一律保持未讀。",
        olderThan_off: "所有訊息",
        olderThan_hours: "{n} 小時",
        set_keepMentions: "有提及的頻道保持未讀",
        channels_excluded: "已排除的頻道（右鍵點擊頻道即可加入）",
        channels_none: "無",
        button_clear: "全部移除",
        tooltip_more: "另有 {n} 個",
        set_confirm: "標示或清除前詢問",
        confirm_never: "永不",
        confirm_always: "一律",
        confirm_from: "一次 {n} 個以上時",
        set_clearMarksRead: "清除提及時也將其頻道標示為已讀",
        set_checkUpdates: "檢查更新",
        note_checkUpdates: "在 GitHub 上尋找新版本，並提供一鍵安裝。",
        notice_update: "ReadAllNotificationsButtonv2 {version} 已推出。",
        button_update: "更新",
        toast_updated: "已更新至 {version}",
        toast_updateFailed: "更新失敗：{error}",
        set_buttonStyle: "按鈕樣式",
        style_text: "文字",
        style_icon: "圖示",
        style_both: "圖示和文字",
        set_readOnLeave: "切換到其他伺服器時將其標示為已讀",
        set_activeFrom: "自動已讀開始時間",
        set_activeTo: "自動已讀結束時間",
        note_activeHours: "適用於定時、已靜音的伺服器和啟動時。相同的小時或「任何時間」表示一律生效。",
        hours_any: "任何時間",
        set_clearHotkey: "清除提及的快速鍵",
        context_clear_all: "所有提及",
        context_clear_server: "此伺服器的提及",
        context_clear_old: "超過一天的提及",
        settings_stats: "統計",
        stats_text: "已標示為已讀：{servers} 個伺服器、{dms} 個私人訊息 · 已清除提及：{mentions}",
        button_reset: "重設",
        toast_noMentions: "沒有符合的提及",
    },
};
