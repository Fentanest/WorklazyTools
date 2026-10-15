import { FileDropZone } from "../../components/ui";

/** Pair inputs consume only this selection, never the previous pair again. */
export function PairFileDropZone(props: {
  label: string; hint: string; accept: string; files: File[];
  onFiles: (files: File[]) => void | Promise<void>; disabled?: boolean;
}) {
  return <div className="mt-3" data-testid="excel-pair-drop-zone"><FileDropZone {...props} multiple onNewFiles={props.onFiles} /></div>;
}
