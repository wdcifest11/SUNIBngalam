type CardChromeProps = {
  kicker?: string;
  title: string;
  meta?: string;
};

export default function CardChrome({ kicker, title, meta }: CardChromeProps) {
  return (
    <div className="cardInner" aria-hidden="true">
      {kicker ? <div className="cardKicker">{kicker}</div> : null}
      <div className="cardTitle">{title}</div>
      {meta ? <div className="cardMeta">{meta}</div> : null}
    </div>
  );
}

