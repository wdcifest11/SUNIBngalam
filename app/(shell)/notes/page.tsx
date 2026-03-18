import NotesHub from "../../../components/notes/notes-hub";
import ViewMarker from "../../../components/view-marker";
import { Suspense } from "react";

export default function Page() {
  return (
    <>
      <ViewMarker view="notes" />
      <Suspense fallback={null}>
        <NotesHub />
      </Suspense>
    </>
  );
}
