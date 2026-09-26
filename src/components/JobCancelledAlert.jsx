/**
 * Full-screen notice that the household cancelled a job this collector had
 * accepted. Icon-first with one large button so it works without reading.
 */
const JobCancelledAlert = ({ onClose }) => (
  <div
    className="fixed inset-0 z-[10000] flex flex-col items-center justify-center gap-8 bg-red-600 p-4 text-center text-white"
    role="alertdialog"
    aria-labelledby="job-cancelled-title"
  >
    <div className="text-8xl" aria-hidden="true">❌</div>
    <h1 id="job-cancelled-title" className="text-3xl font-bold">Job cancelled</h1>
    <button
      type="button"
      onClick={onClose}
      className="w-full max-w-xs rounded-2xl bg-white px-6 py-5 text-2xl font-bold text-red-600 shadow-lg active:bg-red-100"
    >
      👍 OK
    </button>
  </div>
);

export default JobCancelledAlert;
