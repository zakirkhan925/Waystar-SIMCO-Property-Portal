import type { Metadata } from "next";
import { Pencil, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listProjectsBrief, listUsers } from "@/features/users/queries";
import { UserDialog } from "@/features/users/user-dialog";
import type { STAFF_ROLES } from "@/features/users/schemas";
import { requireRole } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Users & roles" };

export default async function UsersPage() {
  await requireRole("super_admin");
  const [users, projects] = await Promise.all([listUsers(), listProjectsBrief()]);
  const projectCode = new Map(projects.map((p) => [p.id, p.code]));

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Settings", href: "/settings" }, { label: "Users & roles" }]}
        title="Users & roles"
        description="Accounts are created here; people can't sign themselves up."
        actions={
          <UserDialog
            projects={projects}
            trigger={
              <Button size="sm">
                <Plus /> Add user
              </Button>
            }
          />
        }
      />
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Projects</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="font-medium">{u.full_name}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </TableCell>
                <TableCell>{ROLE_LABELS[u.role]}</TableCell>
                <TableCell className="whitespace-normal">
                  {u.role === "super_admin" || u.role === "manager" ? (
                    <span className="text-xs text-muted-foreground">All</span>
                  ) : u.project_ids.length === 0 ? (
                    <span className="text-xs text-destructive">None</span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {u.project_ids.map((id) => (
                        <Badge key={id} variant="outline">
                          {projectCode.get(id)}
                        </Badge>
                      ))}
                    </span>
                  )}
                </TableCell>
                <TableCell>{u.is_active ? <Badge variant="secondary">Active</Badge> : <Badge variant="destructive">Deactivated</Badge>}</TableCell>
                <TableCell>
                  <UserDialog
                    projects={projects}
                    user={{
                      id: u.id,
                      full_name: u.full_name,
                      email: u.email ?? "",
                      phone: u.phone ?? "",
                      role: u.role as (typeof STAFF_ROLES)[number],
                      is_active: u.is_active,
                      project_ids: u.project_ids,
                    }}
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label={`Edit ${u.full_name}`}>
                        <Pencil />
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
