export default function Footer({ attribution }: { attribution: string }) {
  return (
    <footer className="footer">
      <p>{attribution}</p>
    </footer>
  );
}
