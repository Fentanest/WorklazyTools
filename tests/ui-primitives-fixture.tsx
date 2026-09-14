import * as React from "react";
import { createRoot } from "react-dom/client";

import { Button } from "../src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../src/components/ui/card";
import { Progress, ProgressIndicator, ProgressLabel, ProgressTrack, ProgressValue } from "../src/components/ui/progress";
import { Switch } from "../src/components/ui/switch";
import { Toggle } from "../src/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "../src/components/ui/toggle-group";
import "../src/styles/tailwind.css";

function SwitchDemo() {
  const [checked, setChecked] = React.useState(false);
  return (
    <section data-testid="fixture-switch">
      <Switch data-testid="switch-uncontrolled" defaultChecked={false} aria-label="uncontrolled" onCheckedChange={(next) => setChecked(next)} />
      <span data-testid="switch-uncontrolled-state">{checked ? "on" : "off"}</span>
      <Switch data-testid="switch-controlled" checked={false} onCheckedChange={() => undefined} aria-label="controlled" />
      <Switch data-testid="switch-readonly" defaultChecked={false} readOnly aria-label="readonly" />
      <Switch data-testid="switch-disabled" defaultChecked={false} disabled aria-label="disabled" />
      <Switch data-testid="switch-sm" size="sm" defaultChecked aria-label="small" />
    </section>
  );
}

function ToggleDemo() {
  const [pressed, setPressed] = React.useState(false);
  return (
    <section data-testid="fixture-toggle">
      <Toggle data-testid="toggle-basic" pressed={pressed} onPressedChange={setPressed}>Toggle</Toggle>
      <ToggleGroup data-testid="toggle-group-single" defaultValue={["a"]} aria-label="single">
        <ToggleGroupItem data-testid="tg-a" value="a">A</ToggleGroupItem>
        <ToggleGroupItem data-testid="tg-b" value="b">B</ToggleGroupItem>
        <ToggleGroupItem data-testid="tg-c" value="c" disabled>C</ToggleGroupItem>
      </ToggleGroup>
      <ToggleGroup data-testid="toggle-group-multiple" multiple defaultValue={["a"]} aria-label="multiple">
        <ToggleGroupItem data-testid="tgm-a" value="a">A</ToggleGroupItem>
        <ToggleGroupItem data-testid="tgm-b" value="b">B</ToggleGroupItem>
      </ToggleGroup>
    </section>
  );
}

function ButtonDemo() {
  const [count, setCount] = React.useState(0);
  return (
    <section data-testid="fixture-button">
      <Button data-testid="button-basic" onClick={() => setCount((value) => value + 1)}>Click</Button>
      <span data-testid="button-count">{count}</span>
      <Button data-testid="button-busy" busy onClick={() => setCount(1000)}>Busy</Button>
      <Button data-testid="button-disabled" disabled onClick={() => setCount(1000)}>Disabled</Button>
      <Button data-testid="button-anchor" render={<a href="https://example.com/page" target="_blank" rel="noreferrer">Anchor</a>} />
      <Button data-testid="button-anchor-disabled" disabled render={<a href="https://example.com/blocked">Blocked</a>} />
      <Button data-testid="button-submit" type="submit">Submit</Button>
    </section>
  );
}

function ProgressDemo() {
  return (
    <section data-testid="fixture-progress">
      <Progress data-testid="progress-40" value={40}><ProgressTrack><ProgressIndicator /></ProgressTrack></Progress>
      <Progress data-testid="progress-null" value={null}><ProgressTrack><ProgressIndicator /></ProgressTrack></Progress>
      <Progress data-testid="progress-clamp" value={150} min={20} max={80}><ProgressTrack><ProgressIndicator /></ProgressTrack></Progress>
      <Progress data-testid="progress-nan" value={Number.NaN}><ProgressTrack><ProgressIndicator /></ProgressTrack></Progress>
      <Progress data-testid="progress-labeled" value={25} aria-label="loading files" />
      <Progress data-testid="progress-with-label" value={50}>
        <ProgressLabel>Files</ProgressLabel>
        <ProgressTrack><ProgressIndicator /></ProgressTrack>
        <ProgressValue />
      </Progress>
    </section>
  );
}

function CardDemo() {
  return (
    <section data-testid="fixture-card">
      <Card data-testid="card-basic">
        <CardHeader><CardTitle>Title</CardTitle><CardDescription>Desc</CardDescription></CardHeader>
        <CardContent>Body</CardContent>
      </Card>
    </section>
  );
}

function App() {
  return (
    <main>
      <ButtonDemo />
      <SwitchDemo />
      <ToggleDemo />
      <ProgressDemo />
      <CardDemo />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
