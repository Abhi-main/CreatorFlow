import { useEffect, useMemo, useState } from "react";

function stableStringify(value) {
  return JSON.stringify(value || {});
}

export default function useUnsavedChanges(initialValues = {}, currentValues = {}) {
  const [baseline, setBaseline] = useState(initialValues);
  const isDirty = useMemo(() => stableStringify(baseline) !== stableStringify(currentValues), [baseline, currentValues]);

  useEffect(() => {
    function handleBeforeUnload(event) {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  function setInitialValues(values) {
    setBaseline(values);
  }

  function confirmLeave() {
    return !isDirty;
  }

  return { isDirty, setInitialValues, confirmLeave };
}
