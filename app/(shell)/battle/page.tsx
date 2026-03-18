import BattleGrid from "../../../components/grids/battle-grid";
import ViewMarker from "../../../components/view-marker";

export default function Page() {
  return (
    <>
      <ViewMarker view="battle" />
      <BattleGrid />
    </>
  );
}
