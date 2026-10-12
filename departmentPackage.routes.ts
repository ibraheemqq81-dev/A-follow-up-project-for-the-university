import { Express, Request, Response } from 'express';
import { processDepartmentPackage, DepartmentPackagePayload } from './departmentPackage.logic.ts';
import { db } from './src/db/index.ts';
import { departments } from './src/db/schema.ts';
import { eq } from 'drizzle-orm';

export interface RouteDependencies {
  authenticateToken: any;
  requireRole: any;
  applyScope: any;
  generateId?: (prefix: string) => string;
  getCurrentTerm: () => Promise<{ academicYear: string; semester: string }>;
}

export function registerDepartmentPackageRoutes(app: Express, deps: RouteDependencies) {
  const { authenticateToken, requireRole, applyScope } = deps;

  app.post(
    '/api/import/department-package',
    authenticateToken,
    requireRole('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'),
    applyScope,
    async (req: Request, res: Response) => {
      try {
        const user = req.user;
        let currentTerm: { academicYear: string; semester: string };
        try { currentTerm = await deps.getCurrentTerm(); }
        catch (error: any) { return res.status(409).json({ success: false, error: { code: 'CURRENT_TERM_NOT_CONFIGURED', message: error.message } }); }
        const body = req.body || {};

        // Extract payload
        const payload: DepartmentPackagePayload = body.packageData || body.payload || body;
        const dryRun = body.dryRun === true || req.query.dryRun === 'true';
        const confirmConflicts = body.confirmConflicts === true || req.query.confirmConflicts === 'true';
        const overrideReason = body.overrideReason || (req.query.overrideReason as string) || '';

        if (!payload || !payload.departmentId) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'BAD_REQUEST',
              message: 'بيانات حزمة القسم ومعرف القسم (departmentId) مطلوبة',
            },
          });
        }

        const targetDepartment = (await db.select({ collegeId: departments.collegeId }).from(departments).where(eq(departments.id, payload.departmentId)).limit(1))[0];
        if (!targetDepartment) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'القسم المحدد غير موجود' } });
        if (payload.collegeId && payload.collegeId !== targetDepartment.collegeId) {
          return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'الكلية لا تطابق الكلية الفعلية للقسم' } });
        }

        // Scope check for DEPARTMENT_MONITOR
        if (user && user.role === 'DEPARTMENT_MONITOR') {
          if (!user.assignedDepartmentId || user.assignedDepartmentId !== payload.departmentId) {
            return res.status(403).json({
              success: false,
              error: {
                code: 'FORBIDDEN',
                message: 'ليس لديك صلاحية استيراد حزمة لقسم آخر خارج نطاق قسمك المخصص',
              },
            });
          }
        }

        // Scope check for COLLEGE_MONITOR
        if (user && user.role === 'COLLEGE_MONITOR') {
          if (!user.assignedCollegeId || user.assignedCollegeId !== targetDepartment.collegeId) {
            return res.status(403).json({
              success: false,
              error: {
                code: 'FORBIDDEN',
                message: 'ليس لديك صلاحية استيراد حزمة لكلية أخرى خارج نطاق كليتك المخصصة',
              },
            });
          }
        }

        const result = await processDepartmentPackage(payload, {
          dryRun,
          confirmConflicts,
          overrideReason,
          academicYear: currentTerm.academicYear,
          semester: currentTerm.semester,
          user: user ? {
            id: user.id,
            name: user.name,
            role: user.role,
            assignedDepartmentId: user.assignedDepartmentId || undefined,
            assignedCollegeId: user.assignedCollegeId || undefined,
          } : undefined,
        });

        const statusCode = result.status || (result.success ? (dryRun ? 200 : 201) : 400);

        if (!result.success) {
          return res.status(statusCode).json({
            success: false,
            message: result.message,
            conflicts: result.conflicts || [],
            error: {
              code: statusCode === 409 ? 'CONFLICT' : statusCode === 403 ? 'FORBIDDEN' : 'BAD_REQUEST',
              message: result.message,
            },
          });
        }

        return res.status(statusCode).json({
          success: true,
          dryRun: result.dryRun,
          summary: result.summary,
          created: result.created,
          conflicts: result.conflicts || [],
          message: result.message,
        });
      } catch (err: any) {
        console.error('[DepartmentPackageRoute] Error:', err);
        return res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: `حدث خطأ داخلي في الخادم أثناء معالجة حزمة القسم: ${err.message}`,
          },
        });
      }
    }
  );
}
