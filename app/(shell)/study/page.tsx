import StudyFocusRoom from "../../../components/grids/study-focus-room";
import ViewMarker from "../../../components/view-marker";

export default function Page() {
  return (
    <>
      <ViewMarker view="study" label="Study Room" desc="Customize goals, then start a session." />
      <StudyFocusRoom />
    </>
  );
}
