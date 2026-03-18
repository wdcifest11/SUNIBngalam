import CardChrome from "./grid-parts/card-chrome";

export default function RoutineGrid() {
  return (
    <div className="gridContainer" aria-label="Routine grid">
      <div className="gridContainerLeft">
        <div
          className="gridContainerLeftTop gridCard"
          id="grid-leftTop"
          data-focus="routine.overview"
          tabIndex={0}
          role="button"
          aria-label="Routine overview"
        >
          <CardChrome kicker="Today" title="Daily Routine" meta="Now | Next | Later | Plan" />
        </div>
        <div className="gridContainerLeftBottom">
          <div
            className="gridContainerLeftBottomLeft gridCard"
            id="grid-streak"
            data-focus="routine.rules"
            tabIndex={0}
            role="button"
            aria-label="Consequences"
          >
            <CardChrome kicker="Streak rules" title="Keep it alive" meta="Skip -> streak drops | Miss -> strike" />
          </div>
          <div
            className="gridContainerLeftBottomRight gridCard"
            id="grid-quick"
            data-focus="routine.start"
            tabIndex={0}
            role="button"
            aria-label="Start now"
          >
            <CardChrome kicker="Start" title="Focus 25" meta="Pomodoro linked to current task" />
          </div>
        </div>
      </div>

      <div className="gridContainerRight">
        <div className="gridContainerRightLeft">
          <div className="gridContainerRightLeftOne gridCard" id="grid-quest1" data-focus="routine.now" tabIndex={0} role="button" aria-label="Now">
            <CardChrome kicker="Now" title="Focus" meta="25m | 1 task | +60 XP" />
          </div>
          <div className="gridContainerRightLeftTwo gridCard" id="grid-quest2" data-focus="routine.next" tabIndex={0} role="button" aria-label="Next">
            <CardChrome kicker="Next" title="Battle" meta="10m | quick quiz | +40 XP" />
          </div>
          <div className="gridContainerRightLeftThree gridCard" id="grid-quest3" data-focus="routine.later" tabIndex={0} role="button" aria-label="Later">
            <CardChrome kicker="Later" title="Notes" meta="Capture summary | tag | link task" />
          </div>
          <div className="gridContainerRightLeftFour gridCard" id="grid-quest4" data-focus="routine.plan" tabIndex={0} role="button" aria-label="Plan">
            <CardChrome kicker="Plan" title="Group session" meta="Invite guild | co-focus" />
          </div>
        </div>

        <div className="gridContainerRightRight gridCard" id="grid-widget" data-focus="routine.details" tabIndex={0} role="button" aria-label="Routine details">
          <CardChrome kicker="Details" title="Run breakdown" meta="Steps | XP | time estimates" />
        </div>
      </div>
    </div>
  );
}
