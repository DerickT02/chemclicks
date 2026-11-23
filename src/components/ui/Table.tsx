import type { ComponentProps } from "react";

type TableProps = ComponentProps<"table"> & {
  containerClassName?: string;
};

export function Table({ className = "", containerClassName = "", ...props }: TableProps) {
  return (
    <div className={`overflow-x-auto rounded-xl border border-border bg-card shadow-sm ${containerClassName}`}>
      <table className={`w-full text-left text-sm text-foreground ${className}`} {...props} />
    </div>
  );
}

export function TableCaption({ className = "", ...props }: ComponentProps<"caption">) {
  return <caption className={`px-4 py-2.5 text-left text-sm text-muted-foreground ${className}`} {...props} />;
}

export function TableHeader({ className = "", ...props }: ComponentProps<"thead">) {
  return <thead className={`border-b border-border bg-muted ${className}`} {...props} />;
}

export function TableBody({ className = "", ...props }: ComponentProps<"tbody">) {
  return <tbody className={`divide-y divide-border ${className}`} {...props} />;
}

export function TableRow({ className = "", ...props }: ComponentProps<"tr">) {
  return <tr className={`transition-colors hover:bg-muted/50 ${className}`} {...props} />;
}

export function TableHead({ className = "", scope = "col", ...props }: ComponentProps<"th">) {
  return <th scope={scope} className={`px-4 py-2.5 text-left align-top font-semibold ${className}`} {...props} />;
}

export function TableCell({ className = "", ...props }: ComponentProps<"td">) {
  return <td className={`px-4 py-2.5 align-top ${className}`} {...props} />;
}
