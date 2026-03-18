import DashboardGrid from "../../../components/grids/dashboard-grid";
import ViewMarker from "../../../components/view-marker";

export default function Page() {
  return (
    <>
      <ViewMarker view="dashboard" />
      <DashboardGrid />
    </>
  );
}
