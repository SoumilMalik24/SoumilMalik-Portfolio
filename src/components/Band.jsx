const ITEMS = [
  'LLM Engineering', 'RAG Pipelines', 'Agent Design',
  'Fine-tuning', 'MLOps', 'Vector Search',
  'LLM Engineering', 'RAG Pipelines', 'Agent Design',
  'Fine-tuning', 'MLOps', 'Vector Search',
];

export default function Band() {
  return (
    <div className="band">
      <div className="band-track">
        <div className="band-items">
          {ITEMS.map((item, i) => (
            <div className="band-item" key={i}>
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
