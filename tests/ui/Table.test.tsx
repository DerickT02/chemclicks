// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";

afterEach(cleanup);

function ExampleTable() {
  return (
    <Table containerClassName="mt-3">
      <TableCaption className="sr-only">Recent attempts</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Attempt</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableHead scope="row">2</TableHead>
          <TableCell>In progress</TableCell>
        </TableRow>
        <TableRow>
          <TableHead scope="row">1</TableHead>
          <TableCell>Completed</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

describe("Table", () => {
  it("uses native table semantics with a caption and scoped column and row headers", () => {
    render(<ExampleTable />);
    const table = screen.getByRole("table", { name: "Recent attempts" });
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(within(table).getByRole("columnheader", { name: "Attempt" })).toHaveAttribute("scope", "col");
    expect(within(table).getByRole("rowheader", { name: "2" })).toHaveAttribute("scope", "row");
    expect(within(table).getAllByRole("cell").map(cell => cell.textContent)).toEqual(["In progress", "Completed"]);
  });

  it("matches dropdown styling and provides a horizontally scrollable container", () => {
    render(<ExampleTable />);
    const table = screen.getByRole("table");
    expect(table.parentElement).toHaveClass("overflow-x-auto", "rounded-xl", "border", "border-border", "bg-card", "shadow-sm", "mt-3");
    expect(table.querySelector("thead")).toHaveClass("bg-muted", "border-b", "border-border");
    expect(table.querySelector("tbody")).toHaveClass("divide-y", "divide-border");
    expect(screen.getByRole("cell", { name: "Completed" })).toHaveClass("px-4", "py-2.5");
    expect(screen.getByRole("rowheader", { name: "1" })).toHaveClass("px-4", "py-2.5");
  });

  it("preserves native props, refs, and additional classes on each table part", () => {
    const ref = createRef<HTMLTableElement>();
    render(
      <Table ref={ref} id="attempts" className="table-fixed" aria-describedby="table-note">
        <TableCaption id="table-caption" className="sr-only">Attempts</TableCaption>
        <TableHeader id="table-header" className="custom-header">
          <TableRow id="header-row" className="custom-row">
            <TableHead abbr="No." className="custom-head">Attempt number</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody id="table-body" className="custom-body">
          <TableRow>
            <TableCell colSpan={2} className="whitespace-nowrap">No attempts yet.</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const table = screen.getByRole("table", { name: "Attempts" });
    expect(ref.current).toBe(table);
    expect(table).toHaveAttribute("id", "attempts");
    expect(table).toHaveAttribute("aria-describedby", "table-note");
    expect(table).toHaveClass("table-fixed");
    expect(screen.getByText("Attempts")).toHaveAttribute("id", "table-caption");
    expect(screen.getByText("Attempts")).toHaveClass("sr-only");
    expect(table.querySelector("thead")).toHaveAttribute("id", "table-header");
    expect(table.querySelector("thead")).toHaveClass("custom-header");
    expect(table.querySelector("tbody")).toHaveAttribute("id", "table-body");
    expect(table.querySelector("tbody")).toHaveClass("custom-body");
    expect(screen.getByRole("row", { name: "Attempt number" })).toHaveAttribute("id", "header-row");
    expect(screen.getByRole("row", { name: "Attempt number" })).toHaveClass("custom-row");
    expect(screen.getByRole("columnheader")).toHaveAttribute("abbr", "No.");
    expect(screen.getByRole("columnheader")).toHaveClass("custom-head");
    expect(screen.getByRole("cell")).toHaveAttribute("colspan", "2");
    expect(screen.getByRole("cell")).toHaveClass("whitespace-nowrap");
  });

  it("renders on the server without client-only behavior", () => {
    const html = renderToStaticMarkup(<ExampleTable />);
    expect(html).toContain('<caption class="px-4 py-2.5 text-left text-sm text-muted-foreground sr-only">Recent attempts</caption>');
    expect(html).toContain('scope="col"');
    expect(html).toContain('scope="row"');
  });
});
