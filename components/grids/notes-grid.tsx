import CardChrome from "./grid-parts/card-chrome";
import Link from "next/link";
import { appData } from "@/lib/app-data";

export default function NotesGrid() {
  const cards = appData.notes.grid.cards;
  return (
    <div className="gridContainer gridContainer--notes" aria-label="Notes grid">
      <div className="gridContainerLeft">
        <div
          className="gridContainerLeftTop gridCard"
          id="grid-leftTop"
          data-focus="notes.inbox"
          tabIndex={0}
          role="button"
          aria-label="Notes inbox"
        >
          <CardChrome kicker={cards.leftTop.kicker} title={cards.leftTop.title} meta={cards.leftTop.meta} />
        </div>
        <div className="gridContainerLeftBottom">
          <div
            className="gridContainerLeftBottomLeft gridCard"
            id="grid-streak"
            data-focus="notes.tags"
            tabIndex={0}
            role="button"
            aria-label="Tags and folders"
          >
            <CardChrome kicker={cards.tags.kicker} title={cards.tags.title} meta={cards.tags.meta} />
          </div>
          <Link
            href={cards.new.href}
            className="gridContainerLeftBottomRight gridCard"
            id="grid-quick"
            data-focus="notes.new"
            aria-label="Quick capture"
          >
            <CardChrome kicker={cards.new.kicker} title={cards.new.title} meta={cards.new.meta} />
          </Link>
        </div>
      </div>

      <div className="gridContainerRight">
        <div className="gridContainerRightLeft">
          <div
            className="gridContainerRightLeftOne gridCard"
            id="grid-quest1"
            data-focus="notes.recent1"
            tabIndex={0}
            role="button"
            aria-label="Recent note 1"
          >
            <CardChrome kicker={cards.recent[0]?.kicker ?? "Recent"} title={cards.recent[0]?.title ?? "—"} meta={cards.recent[0]?.meta ?? ""} />
          </div>
          <div
            className="gridContainerRightLeftTwo gridCard"
            id="grid-quest2"
            data-focus="notes.recent2"
            tabIndex={0}
            role="button"
            aria-label="Recent note 2"
          >
            <CardChrome kicker={cards.recent[1]?.kicker ?? "Pinned"} title={cards.recent[1]?.title ?? "—"} meta={cards.recent[1]?.meta ?? ""} />
          </div>
          <div
            className="gridContainerRightLeftThree gridCard"
            id="grid-quest3"
            data-focus="notes.link"
            tabIndex={0}
            role="button"
            aria-label="Recent note 3"
          >
            <CardChrome kicker={cards.recent[2]?.kicker ?? "Link"} title={cards.recent[2]?.title ?? "—"} meta={cards.recent[2]?.meta ?? ""} />
          </div>
          <div
            className="gridContainerRightLeftFour gridCard"
            id="grid-quest4"
            data-focus="notes.flashcards"
            tabIndex={0}
            role="button"
            aria-label="Recent note 4"
          >
            <CardChrome kicker={cards.recent[3]?.kicker ?? "Review"} title={cards.recent[3]?.title ?? "—"} meta={cards.recent[3]?.meta ?? ""} />
          </div>
        </div>

        <div
          className="gridContainerRightRight gridCard"
          id="grid-widget"
          data-focus="notes.preview"
          tabIndex={0}
          role="button"
          aria-label="Editor and preview"
        >
          <CardChrome kicker={cards.preview.kicker} title={cards.preview.title} meta={cards.preview.meta} />
        </div>
      </div>
    </div>
  );
}
