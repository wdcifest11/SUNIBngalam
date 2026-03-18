import StudyRoomStrict from "../../../../components/grids/study-room-strict";
import ViewMarker from "../../../../components/view-marker";

export default function Page() {
  return (
    <>
      <ViewMarker view="study" label="Strict Focus" desc="Pomodoro strict mode" />
      <StudyRoomStrict />
    </>
  );
}

