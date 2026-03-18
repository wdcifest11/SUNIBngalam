import CardChrome from "./grid-parts/card-chrome";

export default function PomodoroGrid() {
  return (
    <div className="gridContainer" aria-label="Pomodoro grid">
      <div className="gridContainerLeft">
        <div className="gridContainerLeftTop gridCard" id="grid-leftTop" data-focus="pomodoro.timer" tabIndex={0} role="button" aria-label="Timer">
          <CardChrome kicker="Timer" title="25:00" meta="Focus | linked to quest" />
        </div>
        <div className="gridContainerLeftBottom">
          <div className="gridContainerLeftBottomLeft gridCard" id="grid-streak" data-focus="pomodoro.preset" tabIndex={0} role="button" aria-label="Preset">
            <CardChrome kicker="Preset" title="25/5" meta="Classic | Balanced | Sprint" />
          </div>
          <div className="gridContainerLeftBottomRight gridCard" id="grid-quick" data-focus="pomodoro.coop" tabIndex={0} role="button" aria-label="Co-op">
            <CardChrome kicker="Co-op" title="Invite guild" meta="Sync timer | nudge leave-early" />
          </div>
        </div>
      </div>

      <div className="gridContainerRight">
        <div className="gridContainerRightLeft">
          <div className="gridContainerRightLeftOne gridCard" id="grid-quest1" data-focus="pomodoro.task" tabIndex={0} role="button" aria-label="Task link">
            <CardChrome kicker="Link" title="Task" meta="Pick assignment / material" />
          </div>
          <div className="gridContainerRightLeftTwo gridCard" id="grid-quest2" data-focus="pomodoro.soundscape" tabIndex={0} role="button" aria-label="Music">
            <CardChrome kicker="Assist" title="Soundscape" meta="On | Focus | Off" />
          </div>
          <div className="gridContainerRightLeftThree gridCard" id="grid-quest3" data-focus="pomodoro.rewards" tabIndex={0} role="button" aria-label="Rewards">
            <CardChrome kicker="Rewards" title="+XP" meta="Streak bonus | guild bonus" />
          </div>
          <div className="gridContainerRightLeftFour gridCard" id="grid-quest4" data-focus="pomodoro.history" tabIndex={0} role="button" aria-label="History">
            <CardChrome kicker="History" title="Sessions" meta="Today 3 | Week 14" />
          </div>
        </div>

        <div className="gridContainerRightRight gridCard" id="grid-widget" data-focus="pomodoro.log" tabIndex={0} role="button" aria-label="Session log">
          <CardChrome kicker="Log" title="Timeline" meta="Focus | break | capture" />
        </div>
      </div>
    </div>
  );
}
