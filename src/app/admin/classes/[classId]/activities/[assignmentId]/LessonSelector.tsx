import Dropdown from "@/components/ui/Dropdown";

export const ALL_LESSONS = "all";

type Props = {
  assignmentId: string;
  assignments: readonly { id: string; title: string }[];
  onChange: (assignmentId: string) => void;
};

export function LessonSelector({ assignmentId, assignments, onChange }: Props) {
  return (
    <Dropdown
      label="Lesson"
      variant="heading"
      value={assignmentId}
      options={[
        { value: ALL_LESSONS, label: "See all" },
        ...assignments.map(assignment => ({ value: assignment.id, label: assignment.title })),
      ]}
      onChange={id => {
        if (id !== assignmentId) onChange(id);
      }}
    />
  );
}
