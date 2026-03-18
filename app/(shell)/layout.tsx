import RouteBridge from "../../components/route-bridge";
import ShellBackground from "../../components/shell-background";
import NotificationIsland from "../../components/notifications/notification-island";
import QSStreakPane from "../../components/quick-settings/qs-streak-pane";
import DemoUserName from "../../components/demo/demo-user-name";
import Script from "next/script";
import { appData } from "@/lib/app-data";

const DEMO_USER = {
  id: 1,
  xp: 1350,
  level: 12,
  avatarUrl: "/blockyPng/profilePicture.png",
};

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="shellRoot" data-user-id={DEMO_USER.id}>
      <RouteBridge />

      <div className="shell">
        <div className="header">
          <button
            className="leftUserMenu headerAction"
            id="userMenuBtn"
            data-focus="header.quickSettings"
            type="button"
            aria-label="Quick settings"
          >
            <div className="userAvatar" aria-hidden="true">
              <img className="userAvatar__img" src={DEMO_USER.avatarUrl} alt="" />
            </div>
            <div className="userMeta">
              <div className="userName">
                <DemoUserName fallback="Demo User" />
              </div>
              <div className="userXp">
                <span className="bolt" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M13 2L3 14h8l-1 8 11-14h-8l0-6z" fill="currentColor" />
                  </svg>
                </span>
                <span className="userXp__value">{DEMO_USER.xp.toLocaleString()} XP</span>
              </div>
            </div>
          </button>

          <div className="headerCenter" aria-label="Notifications">
            <NotificationIsland />
            <div className="qsHoldHost" id="qsHoldHost" hidden aria-hidden="true">
              <div className="qsHoldPill" id="qsHoldPill" style={{ ["--qs-hold-duration" as any]: "650ms" }}>
                <svg className="qsHoldRing" viewBox="0 0 360 64" preserveAspectRatio="none" aria-hidden="true">
                  <rect className="qsHoldRingPath" id="qsHoldRingPath" pathLength={100} x="2" y="2" width="356" height="60" rx="30" ry="30" />
                </svg>
                <span className="qsHoldKey" aria-hidden="true">
                  M
                </span>
                <div className="qsHoldText">
                  <div className="qsHoldTitle">Quick settings</div>
                  <div className="qsHoldSub">Hold to open</div>
                </div>
              </div>
            </div>
          </div>

          <div className="rightClockMenu" aria-label="Clock">
            <button className="viewLabel headerAction" id="viewLabel" data-focus="header.pageInfo" type="button" aria-label="Page info">
              {appData.views.dashboard.label}
            </button>
            <span className="clock" id="clock">
              --:--
            </span>
            <div className="viewInfo" id="viewInfo" hidden>
              <div className="viewInfo__title" id="viewInfoTitle">
                {appData.views.dashboard.label}
              </div>
              <div className="viewInfo__desc" id="viewInfoDesc">
                {appData.views.dashboard.desc}
              </div>
            </div>
          </div>
        </div>

        <div id="routeOutlet">{children}</div>

        <div className="navbar" aria-label="Main navigation">
          <div className="carousel" id="carousel" role="tablist" aria-label="Menu switcher">
            {appData.navigation.items.map((it) => (
              <button key={it.id} className="navItem" type="button" data-page={it.page} data-focus={it.focusKey} role="tab" aria-selected="false">
                <i className={`fa-solid ${it.icon}`} aria-hidden="true"></i>
                <span>{it.label}</span>
              </button>
            ))}
          </div>

          <div className="arenaDock" id="arenaDock" hidden aria-label="Arena controls">
            <div className="arenaDockLeft">
              <div className="arenaDockTitle">Arena</div>
              <div className="arenaDockMeta" id="arenaDockMeta">
                Ready
              </div>
            </div>

          <div className="arenaDockKeys" aria-label="Answer keys">
            <span className="arenaKey">A</span>
            <span className="arenaKey">B</span>
            <span className="arenaKey">C</span>
            <span className="arenaKey">D</span>
            <span className="arenaDockHint">or 1–4</span>
          </div>

          <div className="arenaDockActions" aria-label="Arena actions">
            <button className="arenaDockBtn headerAction" id="arenaPauseBtn" type="button" aria-label="Pause match">
              Pause
            </button>
            <button className="arenaDockBtn arenaDockBtnDanger headerAction" id="arenaSurrenderBtn" type="button" aria-label="Surrender match">
              Surrender
            </button>
            <a className="arenaDockBtn headerAction" id="arenaQuitBtn" href="/battle" aria-label="Exit arena">
              Exit
            </a>
          </div>
        </div>
      </div>

        <div className="footerHUD">
          <div className="appver">
            <div className="userName">Studium v1.0.0</div>
          </div>
          <div className="hud">
            <div className="hudBar" aria-label="Controls">
              <div className="hudGroup hudGroup--touch" aria-label="Swipe menu">
                <div className="hudKeys" aria-hidden="true">
                  <span className="hudKey">
                    <i className="fa-solid fa-arrows-left-right"></i>
                  </span>
                </div>
                <div className="hudLabel">Swipe left/right</div>
              </div>

              <div className="hudGroup" aria-label="Navigate">
                <div className="hudKeys" aria-hidden="true">
                  <span className="hudKey">
                    <i className="fa-solid fa-arrow-left"></i>
                  </span>
                  <span className="hudKey">
                    <i className="fa-solid fa-arrow-up"></i>
                  </span>
                  <span className="hudKey">
                    <i className="fa-solid fa-arrow-down"></i>
                  </span>
                  <span className="hudKey">
                    <i className="fa-solid fa-arrow-right"></i>
                  </span>
                </div>
                <div className="hudLabel">Navigate</div>
              </div>

              <div className="hudGroup" aria-label="Quick settings">
                <div className="hudKeys" aria-hidden="true">
                  <span className="hudKey hudKey--hold" id="hudHoldM">
                    <svg className="hudHoldRing" viewBox="0 0 36 36" aria-hidden="true">
                      <circle className="hudHoldRingPath" pathLength={100} cx="18" cy="18" r="16" />
                    </svg>
                    <span className="hudKeyText" aria-hidden="true">
                      M
                    </span>
                  </span>
                </div>
                <div className="hudLabel">Hold quick settings</div>
              </div>

              <div className="hudGroup hudGroup--right" aria-label="Scroll Menu">
                <div className="hudKeys" aria-hidden="true">
                  <span className="hudKey hudKey--mouse">
                    <i className="fa-solid fa-computer-mouse"></i>
                    <i className="fa-solid fa-arrows-up-down hudMouseScroll"></i>
                  </span>
                </div>
                <div className="hudLabel">Scroll Menu</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="drawerOverlay" id="profileOverlay" hidden></div>
      <aside className="drawer" id="profileDrawer" hidden aria-hidden="true" aria-label="Quick settings">
        <div className="drawerTop">
          <div className="drawerTitle">Quick Settings</div>
          <button className="drawerClose headerAction" id="profileCloseBtn" data-focus="drawer.close" type="button" aria-label="Close quick settings">
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        <div className="drawerBody">
          <div className="drawerCard">
            <div className="drawerSectionTitle">Profile</div>
            <button className="drawerUser headerAction" id="qsProfileBtn" data-focus="drawer.profile" type="button" aria-label="Open profile settings">
              <div className="drawerAvatar" aria-hidden="true">
                <img className="drawerAvatar__img" src={DEMO_USER.avatarUrl} alt="" />
              </div>
              <div className="drawerUserMeta">
                <div className="drawerUserName">
                  <DemoUserName fallback="Demo User" />
                </div>
                <div className="drawerUserSub">
                  {DEMO_USER.xp.toLocaleString()} XP | LVL {DEMO_USER.level}
                </div>
              </div>
              <span className="drawerUserChevron" aria-hidden="true">
                <i className="fa-solid fa-chevron-right"></i>
              </span>
            </button>
          </div>

          <div className="drawerCard">
            <div className="drawerSectionTitle">Shortcuts</div>

            <div className="qsMenu" aria-label="Quick shortcuts">
              <button className="qsMenuBtn headerAction" id="qsNotifBtn" data-focus="drawer.notif" type="button" aria-label="Notification settings">
                <span className="qsMenuIcon" aria-hidden="true">
                  <i className="fa-solid fa-bell"></i>
                </span>
                <span className="qsMenuText">Notification</span>
                <span className="qsMenuChevron" aria-hidden="true">
                  <i className="fa-solid fa-chevron-right"></i>
                </span>
              </button>

              <button className="qsMenuBtn headerAction" id="qsQuestBtn" data-focus="drawer.shortcutQuest" type="button" aria-label="Go to Quest">
                <span className="qsMenuIcon" aria-hidden="true">
                  <i className="fa-solid fa-map"></i>
                </span>
                <span className="qsMenuText">Quest</span>
                <span className="qsMenuChevron" aria-hidden="true">
                  <i className="fa-solid fa-chevron-right"></i>
                </span>
              </button>

              <button className="qsMenuBtn headerAction" id="qsScheduleShortcutBtn" data-focus="drawer.shortcutSchedule" type="button" aria-label="Go to Schedule">
                <span className="qsMenuIcon" aria-hidden="true">
                  <i className="fa-solid fa-calendar-days"></i>
                </span>
                <span className="qsMenuText">Schedule</span>
                <span className="qsMenuChevron" aria-hidden="true">
                  <i className="fa-solid fa-chevron-right"></i>
                </span>
              </button>

              <button className="qsMenuBtn headerAction" id="qsStudyShortcutBtn" data-focus="drawer.shortcutStudy" type="button" aria-label="Go to Study Room">
                <span className="qsMenuIcon" aria-hidden="true">
                  <i className="fa-solid fa-book-open"></i>
                </span>
                <span className="qsMenuText">Study Room</span>
                <span className="qsMenuChevron" aria-hidden="true">
                  <i className="fa-solid fa-chevron-right"></i>
                </span>
              </button>

              <button className="qsMenuBtn headerAction" id="qsBattleBtn" data-focus="drawer.shortcutBattle" type="button" aria-label="Go to Battle">
                <span className="qsMenuIcon" aria-hidden="true">
                  <i className="fa-solid fa-fire"></i>
                </span>
                <span className="qsMenuText">Battle</span>
                <span className="qsMenuChevron" aria-hidden="true">
                  <i className="fa-solid fa-chevron-right"></i>
                </span>
              </button>

              <button className="qsMenuBtn headerAction" id="qsNotesBtn" data-focus="drawer.shortcutNotes" type="button" aria-label="Go to Notes">
                <span className="qsMenuIcon" aria-hidden="true">
                  <i className="fa-solid fa-note-sticky"></i>
                </span>
                <span className="qsMenuText">Notes</span>
                <span className="qsMenuChevron" aria-hidden="true">
                  <i className="fa-solid fa-chevron-right"></i>
                </span>
              </button>
            </div>
            <div className="qsBottomRow" aria-label="Quick actions">
              <button className="qsSquareBtn headerAction" id="qsHomeBtn" data-focus="drawer.home" type="button" aria-label="Go to Dashboard">
                <i className="fa-solid fa-table-cells-large" aria-hidden="true"></i>
              </button>
              <button
                className="qsSquareBtn headerAction"
                id="qsSettingsBtn"
                data-focus="drawer.settings"
                type="button"
                aria-label="Open Options"
              >
                <i className="fa-solid fa-gear" aria-hidden="true"></i>
              </button>
              <button className="qsExitBtn headerAction" id="backToLandingBtn" data-focus="drawer.exit" type="button" aria-label="Exit to landing page">
                <span className="qsExitText">Exit Studium Focus Mode</span>
                <span className="qsExitIcon" aria-hidden="true">
                  <i className="fa-solid fa-right-from-bracket"></i>
                </span>
              </button>
            </div>
          </div>

        </div>
      </aside>

      <section className="qsPanel qsProfilePanel" id="qsProfilePanel" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-label="Profile panel">
        <div className="qsProfileTop">
          <div className="qsProfileTitle">Profile</div>
          <div className="qsProfileTopRight">
            <button className="qsProfileClose headerAction" id="qsProfileCloseBtn" type="button" aria-label="Close profile panel">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>
        </div>

        <div className="qsProfileHero" aria-label="Profile summary">
          <div className="qsProfileAvatar" aria-hidden="true">
            <img className="qsProfileAvatarImg" src={DEMO_USER.avatarUrl} alt="" />
          </div>
          <div className="qsProfileMeta">
            <div className="qsProfileName">
              <DemoUserName fallback="Demo User" />
            </div>
            <div className="qsProfileSub">
              {DEMO_USER.xp.toLocaleString()} XP | LVL {DEMO_USER.level}
            </div>
          </div>
        </div>

        <div className="qsProfileTabs" role="tablist" aria-label="Profile tabs">
          <button className="qsProfileTab headerAction" id="qsProfileTabStreak" type="button" role="tab" aria-selected="true" data-tab="streak">
            Streak
          </button>
          <button className="qsProfileTab headerAction" id="qsProfileTabRanking" type="button" role="tab" aria-selected="false" data-tab="ranking">
            Ranking
          </button>
          <button className="qsProfileTab headerAction" id="qsProfileTabFriends" type="button" role="tab" aria-selected="false" data-tab="friends">
            Friends
          </button>
        </div>

        <div className="qsProfileBody" aria-label="Profile content">
          <div className="qsProfilePane" data-pane="streak" aria-label="Streak tab">
            <QSStreakPane />
          </div>
          <div className="qsProfilePane" data-pane="ranking" hidden aria-hidden="true" aria-label="Ranking tab">
            <div className="qsProfilePlaceholderTitle">Ranking</div>
            <div className="qsProfilePlaceholderSub">Show leaderboard + current rank.</div>
          </div>
          <div className="qsProfilePane" data-pane="friends" hidden aria-hidden="true" aria-label="Friends tab">
            <div className="qsProfilePlaceholderTitle">Friends</div>
            <div className="qsProfilePlaceholderSub">Invite / manage friends here.</div>
          </div>
        </div>

        <div className="qsProfileFooter" aria-label="Profile actions">
          <button className="qsProfileFooterBtn qsProfileFooterBtn--primary headerAction" id="qsProfileEditBtn" type="button" aria-label="Edit profile">
            Edit Profile
          </button>
          <button className="qsProfileFooterBtn headerAction" id="qsProfileMoreBtn" type="button" aria-label="More options">
            More options
          </button>
        </div>
      </section>

      <section className="qsPanel" id="qsNotifPanel" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-label="Notification panel">
        <div className="qsPanelTop">
          <div className="qsPanelTitle">Notification</div>
          <div className="qsPanelTopRight">
            <label className="qsMiniToggle" aria-label="Toggle notifications">
              <input id="qsNotifToggle" className="qsMiniToggleInput" type="checkbox" defaultChecked />
              <span className="qsMiniSwitch" aria-hidden="true" />
            </label>
            <button className="qsPanelClose headerAction" id="qsNotifCloseBtn" type="button" aria-label="Close notification panel">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>
        </div>

        <div className="qsPanelBody" aria-label="Notification content">
          <div className="qsPanelCard" aria-label="Notification settings card">
            <div className="qsPanelCardTitle">System notifications</div>
            <div className="qsPanelCardSub">Turn notifications on/off for quick settings.</div>
          </div>
        </div>

        <div className="qsPanelFooter" aria-label="Notification actions">
          <button className="qsPanelFooterBtn qsPanelFooterBtn--primary headerAction" id="qsNotifSettingsBtn" type="button" aria-label="Open notification settings">
            Open Settings
          </button>
        </div>
      </section>

      <section className="qsPanel" id="qsQuestPanel" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-label="Quest panel">
        <div className="qsPanelTop">
          <div className="qsPanelTitle">Quest</div>
          <div className="qsPanelTopRight">
            <button className="qsPanelClose headerAction" id="qsQuestCloseBtn" type="button" aria-label="Close quest panel">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>
        </div>

        <div className="qsPanelBody" aria-label="Quest content">
          <div className="qsPanelCard" aria-label="Quest summary">
            <div className="qsPanelCardTitle" id="qsQuestSummaryTitle">
              Active quests
            </div>
            <div className="qsPanelCardSub" id="qsQuestSummarySub">
              Loading your quests...
            </div>
          </div>

          <div className="qsQuestList" id="qsQuestList" role="list" aria-label="Quest list"></div>

          <div className="qsPanelCard qsQuestEmpty" id="qsQuestEmpty" hidden aria-hidden="true" aria-label="No quests">
            <div className="qsPanelCardTitle">No quests yet</div>
            <div className="qsPanelCardSub">Create a quest to start earning XP and streaks.</div>
          </div>
        </div>

        <div className="qsPanelFooter" aria-label="Quest actions">
          <button className="qsPanelFooterBtn qsPanelFooterBtn--primary headerAction" id="qsQuestOpenBtn" type="button" aria-label="Open quest page">
            View all quests
          </button>
        </div>
      </section>

      <section className="qsPanel" id="qsSchedulePanel" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-label="Schedule panel">
        <div className="qsPanelTop">
          <div className="qsPanelTitle">Schedule</div>
          <div className="qsPanelTopRight">
            <button className="qsPanelClose headerAction" id="qsScheduleCloseBtn" type="button" aria-label="Close schedule panel">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>
        </div>

        <div className="qsPanelBody" aria-label="Schedule content">
          <div className="qsPanelCard" aria-label="Calendar list">
            <div className="qsPanelCardTitle" id="qsScheduleSummaryTitle">
              Calendar
            </div>
            <div className="qsPanelCardSub" id="qsScheduleSummarySub">
              Tap a day to open your schedule.
            </div>
            <div className="qsQuestList qsScheduleCalendarList" id="qsScheduleCalendarList" role="list" aria-label="Calendars" />
            <div className="qsQuestList qsScheduleList" id="qsScheduleList" role="list" aria-label="Upcoming days" />
          </div>

          <div className="qsPanelCard qsQuestEmpty qsScheduleEmpty" id="qsScheduleEmpty" hidden aria-hidden="true" aria-label="No events">
            <div className="qsPanelCardTitle">No events yet</div>
            <div className="qsPanelCardSub">Add events in Schedule to see them here.</div>
          </div>
        </div>

        <div className="qsPanelFooter" aria-label="Schedule actions">
          <button className="qsPanelFooterBtn qsPanelFooterBtn--primary headerAction" id="qsScheduleOpenBtn" type="button" aria-label="Open schedule page">
            Open Schedule
          </button>
        </div>
      </section>

      <section className="qsPanel" id="qsStudyPanel" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-label="Study room panel">
        <div className="qsPanelTop">
          <div className="qsPanelTitle">Study Room</div>
          <div className="qsPanelTopRight">
            <button className="qsPanelClose headerAction" id="qsStudyCloseBtn" type="button" aria-label="Close study room panel">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>
        </div>

        <div className="qsPanelBody" aria-label="Study room content">
          <div className="qsPanelCard" aria-label="Study stats">
            <div className="qsPanelCardTitle">Today</div>
            <div className="qsPanelCardSub" id="qsStudyMinutesSub">
              Loading your study stats...
            </div>
          </div>
          <button
            className="qsMenuBtn headerAction qsStudyStartBar"
            id="qsStudyStartBtn"
            type="button"
            aria-label="Open study room"
            data-focus="drawer.study.start"
          >
            <span className="qsMenuIcon" aria-hidden="true">
              <i className="fa-solid fa-bolt" aria-hidden="true"></i>
            </span>
            <span className="qsMenuTextWrap">
              <span className="qsMenuText">Let's start focus</span>
              <span className="qsMenuSub">Jump into Study Room</span>
            </span>
            <span className="qsMenuChevron" aria-hidden="true">
              <i className="fa-solid fa-chevron-right"></i>
            </span>
          </button>
        </div>

        <div className="qsPanelFooter" aria-label="Study room actions">
          <button className="qsPanelFooterBtn qsPanelFooterBtn--primary headerAction" id="qsStudyOpenBtn" type="button" aria-label="Open study room page">
            Open Study Room
          </button>
        </div>
      </section>

      <section className="qsPanel" id="qsBattlePanel" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-label="Battle panel">
        <div className="qsPanelTop">
          <div className="qsPanelTitle">Battle</div>
          <div className="qsPanelTopRight">
            <button className="qsPanelClose headerAction" id="qsBattleCloseBtn" type="button" aria-label="Close battle panel">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>
        </div>

        <div className="qsPanelBody" aria-label="Battle content">
          <button className="qsMenuBtn qsBattleModeBar headerAction" id="qsBattleModeBtn" type="button" aria-label="Open battle modes">
            <span className="qsMenuIcon" aria-hidden="true">
              <i className="fa-solid fa-trophy" aria-hidden="true"></i>
            </span>
            <span className="qsMenuText">Battle mode</span>
            <span className="qsMenuChevron" aria-hidden="true">
              <i className="fa-solid fa-chevron-right"></i>
            </span>
          </button>

          <div className="qsPanelCard" aria-label="Battle statistics">
            <div className="qsPanelCardTitle">Statistics</div>
            <div className="qsBattleStatGrid" aria-label="Battle stats grid">
              <div className="qsBattleStat">
                <div className="qsBattleStatLabel">ELO</div>
                <div className="qsBattleStatValue" id="qsBattleStatEloVal">
                  0
                </div>
              </div>
              <div className="qsBattleStat">
                <div className="qsBattleStatLabel">Rank</div>
                <div className="qsBattleStatValue" id="qsBattleStatRankVal">
                  —
                </div>
              </div>
              <div className="qsBattleStat">
                <div className="qsBattleStatLabel">Winrate</div>
                <div className="qsBattleStatValue" id="qsBattleStatWinrateVal">
                  0%
                </div>
              </div>
              <div className="qsBattleStat">
                <div className="qsBattleStatLabel">Battle XP</div>
                <div className="qsBattleStatValue" id="qsBattleStatXpVal">
                  +0
                </div>
              </div>
            </div>
          </div>

          <div className="qsPanelCard" aria-label="Based on your quest">
            <div className="qsPanelCardTitle">Based on your quest</div>
            <div className="qsPanelCardSub" id="qsBattleQuestSub">
              Recommendations from your active quests.
            </div>
            <div className="qsBattleQuestList" id="qsBattleQuestList" role="list" aria-label="Quest-based battle list"></div>
            <div className="qsBattleQuestEmpty" id="qsBattleQuestEmpty" hidden aria-hidden="true" aria-label="No quest-based battle recommendations">
              No active quests yet.
            </div>
          </div>

          <div className="qsPanelCard" aria-label="Leaderboard">
            <div className="qsPanelCardTitle">Leaderboard</div>
            <div className="qsBattleLbList" id="qsBattleLbList" role="list" aria-label="Battle leaderboard list"></div>
          </div>
        </div>

        <div className="qsPanelFooter" aria-label="Battle actions">
          <button className="qsPanelFooterBtn qsPanelFooterBtn--primary headerAction" id="qsBattleOpenBtn" type="button" aria-label="Open battle page">
            Open Battle
          </button>
        </div>
      </section>

      <section className="qsPanel" id="qsNotesPanel" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-label="Notes panel">
        <div className="qsPanelTop">
          <div className="qsPanelTitle">Notes</div>
          <div className="qsPanelTopRight">
            <button className="qsPanelClose headerAction" id="qsNotesCloseBtn" type="button" aria-label="Close notes panel">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>
        </div>

        <div className="qsPanelBody" aria-label="Notes content">
          <div className="qsPanelCard" aria-label="Notes summary">
            <div className="qsPanelCardTitle" id="qsNotesSummaryTitle">
              Notes
            </div>
            <div className="qsPanelCardSub" id="qsNotesSummarySub">
              Pick something to jump into Notes.
            </div>
          </div>

          <div className="qsPanelCard" aria-label="Notes folders">
            <div className="qsPanelCardTitle">Folders</div>
            <div className="qsQuestList qsNotesList" id="qsNotesFolderList" role="list" aria-label="Notes folder list"></div>
            <div className="qsPanelCardSub qsNotesEmpty" id="qsNotesFolderEmpty" hidden aria-hidden="true">
              No folders yet.
            </div>
          </div>

          <div className="qsPanelCard" aria-label="Notes tags">
            <div className="qsPanelCardTitle">Tags</div>
            <div className="qsQuestList qsNotesList" id="qsNotesTagList" role="list" aria-label="Notes tag list"></div>
            <div className="qsPanelCardSub qsNotesEmpty" id="qsNotesTagEmpty" hidden aria-hidden="true">
              No tags yet.
            </div>
          </div>

          <div className="qsPanelCard" aria-label="Recent notes">
            <div className="qsPanelCardTitle">Recent notes</div>
            <div className="qsQuestList qsNotesList" id="qsNotesAllList" role="list" aria-label="Notes list"></div>
            <div className="qsPanelCardSub qsNotesEmpty" id="qsNotesAllEmpty" hidden aria-hidden="true">
              No notes yet.
            </div>
          </div>

          <div className="qsPanelCard" aria-label="Recent notes">
            <div className="qsQuestList qsNotesList" id="qsNotesRecentList" role="list" aria-label="Recent notes list"></div>
            <div className="qsPanelCardSub qsNotesEmpty" id="qsNotesRecentEmpty" hidden aria-hidden="true">
              No notes in the last 6 hours.
            </div>
          </div>
        </div>

        <div className="qsPanelFooter" aria-label="Notes actions">
          <button className="qsPanelFooterBtn qsPanelFooterBtn--primary headerAction" id="qsNotesOpenBtn" type="button" aria-label="Open notes page">
            Open Notes
          </button>
        </div>
      </section>

      <div className="bg">
        <ShellBackground />
        <div className="bg__veil" aria-hidden="true"></div>
      </div>

      <div
        className="bootOverlay"
        id="bootOverlay"
        aria-hidden="true"
        style={{ background: "rgba(0,0,0,1)", position: "fixed", inset: 0, zIndex: 12000, pointerEvents: "none" }}
      >
        <div className="bootLogo" id="bootLogo">
          <div className="bootLogo__title">STUDIUM</div>
          <div className="bootLogo__tag">Study like a game, finish like a pro.</div>
        </div>
      </div>

      <Script src="/studium-client.js" strategy="afterInteractive" />
    </main>
  );
}
