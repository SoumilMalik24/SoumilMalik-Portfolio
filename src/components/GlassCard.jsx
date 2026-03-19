export default function GlassCard({ children, hoverable = false, className = "", onClick, style = {} }) {
  const cls = ["glass-card", hoverable && "hoverable", className].filter(Boolean).join(" ");
  return (
    <div className={cls} style={style} onClick={onClick}>
      {children}
    </div>
  );
}
