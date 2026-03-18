import ViewMarker from "../../../../components/view-marker";
import StudyResources from "../../../../components/grids/study-resources";

export default function Page() {
  return (
    <>
      <ViewMarker view="study" label="Study Room" desc="Resource Board (local)" />
      <StudyResources />
    </>
  );
}

