import { useId, useState, type ReactNode } from "react";
import { BarChart3, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import VolumeIntensityTable from "@/components/admin/VolumeIntensityTable";

interface Props {
  clientId: string;
  testSelector?: ReactNode;
  children: ReactNode;
}

const WorkoutPlanReferencePanel = ({ clientId, testSelector, children }: Props) => {
  const panelId = useId();
  const [showVolume, setShowVolume] = useState(false);
  const [volumeOpened, setVolumeOpened] = useState(false);

  const toggleView = () => {
    setVolumeOpened(true);
    setShowVolume(previous => !previous);
  };

  return (
    <Card className="min-w-0 overflow-hidden">
      <div className="space-y-2 border-b bg-muted px-3 py-2">
        <h3 className="flex items-center gap-2 font-display text-sm tracking-wider">
          {showVolume ? <BarChart3 className="h-4 w-4 shrink-0 text-primary" /> : <FileText className="h-4 w-4 shrink-0 text-primary" />}
          {showVolume ? "Volume & Intensità" : "Test & Note"}
        </h3>
        <Button type="button" variant="outline" size="sm" className="h-auto min-h-8 w-full whitespace-normal text-xs"
          aria-controls={panelId} onClick={toggleView}>
          {showVolume ? <FileText className="mr-2 h-3.5 w-3.5 shrink-0" /> : <BarChart3 className="mr-2 h-3.5 w-3.5 shrink-0" />}
          {showVolume ? "Torna a Test & Note" : "Mostra Volume & Intensità"}
        </Button>
        <div hidden={showVolume}>{testSelector}</div>
      </div>
      <CardContent id={panelId} className="max-h-[calc(100dvh-280px)] min-h-40 overflow-y-auto p-3">
        <div hidden={showVolume}>{children}</div>
        {/* Keep drafts and pending autosaves alive when returning to Test & Note. */}
        {volumeOpened && (
          <div hidden={!showVolume}>
            <VolumeIntensityTable clientId={clientId} compact />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WorkoutPlanReferencePanel;
