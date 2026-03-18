import ClientOnly from "../../../components/client-only";
import SchedulesGrid from "../../../components/grids/schedules-grid";
import ViewMarker from "../../../components/view-marker";

export default function Page() {
  return (
    <>
      <ViewMarker view="schedules" />
      <ClientOnly>
        <SchedulesGrid />
      </ClientOnly>
    </>
  );
}
