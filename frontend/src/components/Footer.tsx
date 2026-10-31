export default function Footer({ attribution, model }: { attribution: string; model?: string }) {
  return (
    <footer className="footer">
      <p>{attribution}</p>
      {model ? <p>{model === "ecmwf_ifs025" ? "ECMWF IFS" : model} forecast <span aria-hidden="true">·</span> Times in IST</p> : null}
    </footer>
  );
}
