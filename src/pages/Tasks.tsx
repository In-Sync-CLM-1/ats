import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Play, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { useGeneralTasks, getOverdueDays, GeneralTask } from "@/hooks/useGeneralTasks";
import { GeneralTaskDialog } from "@/components/GeneralTaskDialog";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { supabase } from "@/integrations/supabase/client";

export default function Tasks() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "in_progress" | "completed" | "cancelled">("all");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<GeneralTask | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    fetchUser();
  }, []);

  const { tasks, totalCount, isLoading, createTask, updateTask, deleteTask } = useGeneralTasks({
    status: statusFilter,
    itemsPerPage,
    currentPage,
  });

  const handleCreateTask = () => {
    setSelectedTask(null);
    setDialogOpen(true);
  };

  const handleEditTask = (task: GeneralTask) => {
    setSelectedTask(task);
    setDialogOpen(true);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (confirm("Are you sure you want to delete this task?")) {
      await deleteTask(taskId);
    }
  };

  const handleStartTask = async (task: GeneralTask) => {
    await updateTask({ id: task.id, status: "in_progress" });
  };

  const handleCompleteTask = async (task: GeneralTask) => {
    await updateTask({ id: task.id, status: "completed", completed_at: new Date().toISOString() });
  };

  const handleCancelTask = async (task: GeneralTask) => {
    await updateTask({ id: task.id, status: "cancelled" });
  };

  const handleSubmit = async (taskData: any) => {
    if (selectedTask) {
      await updateTask({ id: selectedTask.id, ...taskData });
    } else {
      await createTask(taskData);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "destructive";
      case "high": return "default";
      case "medium": return "secondary";
      case "low": return "outline";
      default: return "outline";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "default";
      case "in_progress": return "secondary";
      case "pending": return "outline";
      case "cancelled": return "destructive";
      default: return "outline";
    }
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  return (
    <div className="px-8 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold mb-1">Tasks</h2>
          <p className="text-sm text-muted-foreground">Manage and track all your tasks</p>
        </div>
        <Button onClick={handleCreateTask}>
          <Plus className="h-4 w-4 mr-2" />
          New Task
        </Button>
      </div>

      <div className="mb-6 flex items-center justify-between gap-4">
        <Tabs value={statusFilter} onValueChange={(v: any) => { setStatusFilter(v); setCurrentPage(1); }}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="in_progress">In Progress</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Items per page:</span>
          <Select
            value={itemsPerPage.toString()}
            onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); }}
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No tasks found</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 mb-6">
            {tasks.map((task: any) => {
              const overdueDays = getOverdueDays(task.due_date, task.status);
              return (
                <Card key={task.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-2">
                          <CardTitle className="text-lg">{task.task_name}</CardTitle>
                        </div>
                        <CardDescription className="space-y-2">
                          {task.description && (
                            <p className="text-sm">{task.description}</p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={getStatusColor(task.status)}>
                              {task.status.replace("_", " ")}
                            </Badge>
                            <Badge variant={getPriorityColor(task.priority)}>
                              {task.priority}
                            </Badge>
                            {overdueDays > 0 && (
                              <Badge variant="destructive">
                                Overdue by {overdueDays} day{overdueDays > 1 ? "s" : ""}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm">
                            <p><strong>Due:</strong> {format(new Date(task.due_date), "MMM dd, yyyy")}</p>
                          </div>
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {task.status === "pending" && (
                          <Button size="sm" variant="outline" onClick={() => handleStartTask(task)}>
                            <Play className="h-4 w-4 mr-1" />
                            Start
                          </Button>
                        )}
                        {task.status === "in_progress" && (
                          <Button size="sm" variant="default" onClick={() => handleCompleteTask(task)}>
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Complete
                          </Button>
                        )}
                        {(task.status === "pending" || task.status === "in_progress") && (
                          <Button size="sm" variant="destructive" onClick={() => handleCancelTask(task)}>
                            <XCircle className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        )}
                        {currentUserId === task.assigned_by && (
                          <Button size="sm" variant="ghost" onClick={() => handleEditTask(task)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>

          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalCount}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(value) => {
              setItemsPerPage(value);
              setCurrentPage(1);
            }}
          />
        </>
      )}

      <GeneralTaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        task={selectedTask}
      />
    </div>
  );
}
