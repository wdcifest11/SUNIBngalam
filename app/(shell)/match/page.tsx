import MatchGrid from "../../../components/grids/match-grid";
import ViewMarker from "../../../components/view-marker";

const DEMO_USER = {
  id: 1,
  displayName: "Demo User",
  avatarUrl: "/blockyPng/profilePicture.png",
};

export default function Page() {
  return (
    <>
      <ViewMarker view="match" />
      <MatchGrid user={DEMO_USER} />
    </>
  );
}

