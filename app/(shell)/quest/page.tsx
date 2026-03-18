import QuestGrid from "../../../components/grids/quest-grid";
import ClientOnly from "../../../components/client-only";
import ViewMarker from "../../../components/view-marker";

export default function Page() {
  return (
    <>
      <ViewMarker view="quest" />
      <ClientOnly>
        <QuestGrid />
      </ClientOnly>
    </>
  );
}
