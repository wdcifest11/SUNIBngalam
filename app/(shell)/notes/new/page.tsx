import NotesNewWorkspace from "../../../../components/notes/notes-new-workspace";
import ViewMarker from "../../../../components/view-marker";
import { Suspense } from "react";

export default function Page() {
  return (
    <>
      <ViewMarker view="notes" />
      <Suspense fallback={null}>
        <NotesNewWorkspace />
      </Suspense>
    </>
  );
}

