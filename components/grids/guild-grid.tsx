import CardChrome from "./grid-parts/card-chrome";
import { appData } from "@/lib/app-data";

export default function GuildGrid() {
  const cards = appData.guild.grid.cards;
  return (
    <div className="gridContainer gridContainer--guild" aria-label="Guild grid">
      <div className="gridContainerLeft">
        <div
          className="gridContainerLeftTop gridCard"
          id="grid-leftTop"
          data-focus="guild.overview"
          tabIndex={0}
          role="button"
          aria-label="Guild overview"
        >
          <CardChrome kicker={cards.leftTop.kicker} title={cards.leftTop.title} meta={cards.leftTop.meta} />
        </div>
        <div className="gridContainerLeftBottom">
          <div
            className="gridContainerLeftBottomLeft gridCard"
            id="grid-streak"
            data-focus="guild.accountability"
            tabIndex={0}
            role="button"
            aria-label="Accountability"
          >
            <CardChrome kicker={cards.accountability.kicker} title={cards.accountability.title} meta={cards.accountability.meta} />
          </div>
          <div
            className="gridContainerLeftBottomRight gridCard"
            id="grid-quick"
            data-focus="guild.startRoom"
            tabIndex={0}
            role="button"
            aria-label="Start co-focus"
          >
            <CardChrome kicker={cards.startRoom.kicker} title={cards.startRoom.title} meta={cards.startRoom.meta} />
          </div>
        </div>
      </div>

      <div className="gridContainerRight">
        <div className="gridContainerRightLeft">
          <div
            className="gridContainerRightLeftOne gridCard"
            id="grid-quest1"
            data-focus="guild.room1"
            tabIndex={0}
            role="button"
            aria-label="Room 1"
          >
            <CardChrome kicker={cards.rooms[0]?.kicker ?? "Room"} title={cards.rooms[0]?.title ?? "—"} meta={cards.rooms[0]?.meta ?? ""} />
          </div>
          <div
            className="gridContainerRightLeftTwo gridCard"
            id="grid-quest2"
            data-focus="guild.room2"
            tabIndex={0}
            role="button"
            aria-label="Room 2"
          >
            <CardChrome kicker={cards.rooms[1]?.kicker ?? "Room"} title={cards.rooms[1]?.title ?? "—"} meta={cards.rooms[1]?.meta ?? ""} />
          </div>
          <div
            className="gridContainerRightLeftThree gridCard"
            id="grid-quest3"
            data-focus="guild.event"
            tabIndex={0}
            role="button"
            aria-label="Guild event"
          >
            <CardChrome kicker={cards.rooms[2]?.kicker ?? "Event"} title={cards.rooms[2]?.title ?? "—"} meta={cards.rooms[2]?.meta ?? ""} />
          </div>
          <div
            className="gridContainerRightLeftFour gridCard"
            id="grid-quest4"
            data-focus="guild.leaderboard"
            tabIndex={0}
            role="button"
            aria-label="Leaderboard"
          >
            <CardChrome kicker={cards.rooms[3]?.kicker ?? "Rank"} title={cards.rooms[3]?.title ?? "—"} meta={cards.rooms[3]?.meta ?? ""} />
          </div>
        </div>

        <div
          className="gridContainerRightRight gridCard"
          id="grid-widget"
          data-focus="guild.chat"
          tabIndex={0}
          role="button"
          aria-label="Chat and activity"
        >
          <CardChrome kicker={cards.chat.kicker} title={cards.chat.title} meta={cards.chat.meta} />
        </div>
      </div>
    </div>
  );
}
