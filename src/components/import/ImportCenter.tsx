import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileText,
  Clock,
  Layers,
  GraduationCap,
  Building,
  DoorOpen,
  Users,
  BookOpen,
  Calendar,
  RefreshCw,
  Info,
  ShieldCheck,
  ChevronDown,
  Trash2,
  FileCode,
  Check,
} from 'lucide-react';
import ExcelJS from 'exceljs';

type ImportEntityType =
  | 'colleges'
  | 'colleges_departments'
  | 'departments'
  | 'faculty'
  | 'subjects'
  | 'schedules'
  | 'rooms'
  | 'buildings';

interface EntityMeta {
  type: ImportEntityType;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  color: string;
}

const ENTITIES: EntityMeta[] = [
  {
    type: 'colleges',
    title: 'الكليات',
    description: 'استيراد بيانات الكليات وعمداء الكليات وأرقام التواصل',
    icon: GraduationCap,
    roles: ['OWNER'],
    color: 'emerald',
  },
  {
    type: 'colleges_departments',
    title: 'كليات وأقسام (موحد)',
    description: 'استيراد الكليات والأقسام التابعة لها في قالب واحد موحد',
    icon: GraduationCap,
    roles: ['OWNER'],
    color: 'emerald',
  },
  {
    type: 'departments',
    title: 'الأقسام العلمية',
    description: 'استيراد الأقسام التابعة للكليات ورؤساء الأقسام',
    icon: Layers,
    roles: ['OWNER', 'COLLEGE_MONITOR'],
    color: 'blue',
  },
  {
    type: 'faculty',
    title: 'الكادر التدريسي',
    description: 'استيراد السادة التدريسيين والألقاب العلمية والبريد الرسمي',
    icon: Users,
    roles: ['OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'],
    color: 'purple',
  },
  {
    type: 'subjects',
    title: 'المواد والمناهج',
    description: 'استيراد المواد الدراسية، الساعات النظرية والعملية والوحدات',
    icon: BookOpen,
    roles: ['OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'],
    color: 'indigo',
  },
  {
    type: 'schedules',
    title: 'الجداول الدراسية الأسبوعية',
    description: 'استيراد المحاضرات الأسبوعية، القاعات، التدريسيين والشعب',
    icon: Calendar,
    roles: ['OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'],
    color: 'amber',
  },
  {
    type: 'rooms',
    title: 'القاعات والمختبرات',
    description: 'استيراد القاعات الدراسية، السعات ونوع القاعة',
    icon: DoorOpen,
    roles: ['OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'],
    color: 'teal',
  },
  {
    type: 'buildings',
    title: 'المباني الأكاديمية',
    description: 'استيراد مباني الجامعة والمجمعات وعدد الطوابق',
    icon: Building,
    roles: ['OWNER'],
    color: 'slate',
  },
];

export const ImportCenter: React.FC = () => {
  const { user } = useAuth();
  const currentRole = user?.role || 'OWNER';

  // Available entities based on role
  const availableEntities = ENTITIES.filter((e) => e.roles.includes(currentRole));
  const [selectedEntity, setSelectedEntity] = useState<ImportEntityType>(
    availableEntities[0]?.type || 'departments'
  );

  const [activeTab, setActiveTab] = useState<'entity' | 'package' | 'history'>('entity');

  // Single Entity Template State
  const [template, setTemplate] = useState<{
    columns: Array<{ key: string; labelAr: string; labelEn: string; required: boolean; example: string }>;
    sampleData: any[];
  } | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  // Single Entity Upload & Data State
  const [inputMode, setInputMode] = useState<'file' | 'paste'>('file');
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [rawText, setRawText] = useState<string>('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  // Single Entity Execution State
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    count?: number;
    created?: number;
    updated?: number;
    jobId?: string;
    errors?: Array<{ row: number; field: string; message: string }>;
  } | null>(null);

  // Validation state for import preview
  const [validationErrors, setValidationErrors] = useState<Array<{ row: number; field: string; message: string }>>([]);
  const [hasValidated, setHasValidated] = useState<boolean>(false);

  // Department Package States (Excel Multi-Sheet Package)
  const [packageFileName, setPackageFileName] = useState<string>('');
  const [isProcessingPackage, setIsProcessingPackage] = useState(false);
  const [parsedPackage, setParsedPackage] = useState<{
    department?: any;
    stages?: any[];
    sections?: any[];
    faculty?: any[];
    subjects?: any[];
    schedules?: any[];
  } | null>(null);
  const [packagePreviewTab, setPackagePreviewTab] = useState<'dept' | 'stages' | 'sections' | 'faculty' | 'subjects' | 'schedules'>('dept');
  const [isPackageDryRunning, setIsPackageDryRunning] = useState(false);
  const [isPackageImporting, setIsPackageImporting] = useState(false);
  const [packageResult, setPackageResult] = useState<{
    success: boolean;
    message: string;
    stats?: any;
    dryRun?: boolean;
    errors?: any[];
  } | null>(null);

  // Department List for Package Export
  const [allDepartments, setAllDepartments] = useState<any[]>([]);
  const [selectedExportDeptId, setSelectedExportDeptId] = useState<string>('');
  const [isExportingDept, setIsExportingDept] = useState(false);

  // Import History State
  const [jobsHistory, setJobsHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Fetch Template when selected entity changes
  useEffect(() => {
    let isMounted = true;
    async function loadTemplate() {
      setLoadingTemplate(true);
      try {
        const res = await api.getImportTemplate(selectedEntity);
        if (isMounted) {
          setTemplate(res);
        }
      } catch (err) {
        console.error('Error loading template:', err);
      } finally {
        if (isMounted) setLoadingTemplate(false);
      }
    }

    if (activeTab === 'entity') {
      loadTemplate();
    }

    return () => {
      isMounted = false;
    };
  }, [selectedEntity, activeTab]);
  // Fetch Departments when package tab is active
  useEffect(() => {
    if (activeTab === 'package') {
      api.getDepartments().then((depts) => {
        setAllDepartments(depts || []);
        if (depts && depts.length > 0 && !selectedExportDeptId) {
          setSelectedExportDeptId(depts[0].id);
        }
      }).catch((err) => console.error('Error fetching departments:', err));
    }
  }, [activeTab]);

  // Fetch History when history tab active
  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const jobs = await api.getImportJobs();
      setJobsHistory(jobs || []);
    } catch (err) {
      console.error('Error fetching jobs history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // CSV Parsing Helper with Quotes and Arabic Support
  const parseCSV = (csvText: string): any[] => {
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) return [];

    // Detect delimiter: comma, tab, or semicolon
    const firstLine = lines[0];
    let delimiter = ',';
    if (firstLine.includes('\t')) delimiter = '\t';
    else if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';

    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      if (values.length === 0 || values.every((v) => !v)) continue;
      const rowObj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        if (h) {
          rowObj[h] = values[idx] || '';
        }
      });
      rows.push(rowObj);
    }

    return rows;
  };

  // Handle File Upload (.xlsx, .csv)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setFileName(file.name);
    setImportResult(null);

    try {
      const extension = file.name.split('.').pop()?.toLowerCase();

      if (extension === 'csv' || extension === 'txt') {
        const text = await file.text();
        const rows = parseCSV(text);
        setParsedData(rows);
      } else if (extension === 'xlsx' || extension === 'xls') {
        const buffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.worksheets[0];

        if (!worksheet) {
          throw new Error('الملف لا يحتوي على صفحات بيانات صالحة');
        }

        const headers: string[] = [];
        const rows: any[] = [];

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) {
            // Header row
            row.eachCell((cell, colNumber) => {
              headers[colNumber] = String(cell.value || '').trim();
            });
          } else {
            const rowData: Record<string, any> = {};
            let hasValue = false;
            row.eachCell((cell, colNumber) => {
              const header = headers[colNumber];
              if (header) {
                let cellVal = cell.value;
                // Handle rich text or formula result
                if (typeof cellVal === 'object' && cellVal !== null) {
                  if ('result' in cellVal) cellVal = (cellVal as any).result;
                  else if ('text' in cellVal) cellVal = (cellVal as any).text;
                }
                const strVal = cellVal !== undefined && cellVal !== null ? String(cellVal).trim() : '';
                if (strVal) hasValue = true;
                rowData[header] = strVal;
              }
            });
            if (hasValue) {
              rows.push(rowData);
            }
          }
        });

        setParsedData(rows);
      } else {
        throw new Error('صيغة الملف غير مدعومة. يرجى استخدام ملفات Excel (.xlsx, .xls) أو CSV فقط.');
      }
    } catch (err: any) {
      console.error('File parsing error:', err);
      alert(`خطأ في قراءة الملف: ${err.message || 'تأكد من سلامة تنسيق الملف'}`);
      setParsedData([]);
    } finally {
      setIsProcessingFile(false);
      // Reset input value
      e.target.value = '';
    }
  };

  // Handle Direct Paste Parsing (CSV / Tabular)
  const handleParseText = () => {
    if (!rawText.trim()) return;
    setImportResult(null);
    try {
      const rows = parseCSV(rawText);
      setParsedData(rows);
      setFileName('pasted_data.csv');
    } catch (err: any) {
      alert(`خطأ في تحليل البيانات الملصوقة: ${err.message}`);
    }
  };

  // Download Official Template
  const handleDownloadTemplate = () => {
    if (!template || !template.columns) return;

    // Use Arabic headers for user convenience
    const headers = template.columns.map((col) => col.labelAr || col.key);
    const sampleRows = (template.sampleData || []).map((row) =>
      template.columns.map((col) => {
        const val = row[col.key] || row[col.labelAr] || col.example || '';
        // Escape quotes
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',')
    );

    const csvContent = '\uFEFF' + [headers.map((h) => `"${h}"`).join(','), ...sampleRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `قالب_استيراد_${selectedEntity}_جامعة_المستقبل.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Load Sample Template into Data
  const handleLoadSampleData = () => {
    if (!template || !template.sampleData) return;
    setParsedData(template.sampleData);
    setFileName(`sample_${selectedEntity}.xlsx`);
    setImportResult(null);
  };

  // Validate parsed data against template requirements
  const validateParsedData = React.useCallback(
    (data: any[], tmpl: any): Array<{ row: number; field: string; message: string }> => {
      if (!tmpl?.columns) return [];
      const errors: Array<{ row: number; field: string; message: string }> = [];
      const requiredCols = tmpl.columns.filter((c: any) => c.required);
      const validKeys = new Set(tmpl.columns.map((c: any) => c.key));
      const arabicLabelMap: Record<string, string> = {};
      tmpl.columns.forEach((c: any) => {
        arabicLabelMap[c.labelAr] = c.key;
      });

      data.forEach((row, idx) => {
        const rowNum = idx + 2; // +2 because row 1 is header
        requiredCols.forEach((col: any) => {
          const val = row[col.key] ?? row[col.labelAr] ?? '';
          if (!val || String(val).trim() === '') {
            errors.push({ row: rowNum, field: col.labelAr || col.key, message: `الحقل المطلوب فارغ` });
          }
        });
        // Check for unknown columns (mismatched template)
        Object.keys(row).forEach((key) => {
          if (key.trim() && !validKeys.has(key) && !arabicLabelMap[key]) {
            // Skip - not necessarily an error, might be extra column
          }
        });
      });
      return errors;
    },
    []
  );

  // Auto-validate when parsedData or template changes
  useEffect(() => {
    if (parsedData.length > 0 && template) {
      const errors = validateParsedData(parsedData, template);
      setValidationErrors(errors);
      setHasValidated(true);
    } else {
      setValidationErrors([]);
      setHasValidated(false);
    }
  }, [parsedData, template, validateParsedData]);

  // Execute Entity Import
  const handleExecuteImport = async () => {
    if (parsedData.length === 0) {
      alert('لا توجد بيانات للاستيراد!');
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      const res = await api.importEntity(selectedEntity, parsedData, fileName || `import_${selectedEntity}.xlsx`);
      setImportResult({
        success: res.success !== false,
        message: res.message || 'تم الاستيراد بنجاح تام!',
        count: res.count,
        created: res.created,
        updated: res.updated,
        jobId: res.jobId,
        errors: res.errors,
      });
      if (res.success !== false) {
        setParsedData([]);
        setRawText('');
      }
    } catch (err: any) {
      console.error('Import execution error:', err);
      setImportResult({
        success: false,
        message: err.message || 'فشل الاستيراد وتم التراجع عن العملية (Rollback).',
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Download Excel (.xlsx) Template for Single Entity
  const handleDownloadExcelTemplate = async () => {
    if (!template || !template.columns) return;
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'جامعة المستقبل - Al-Mustaqbal University';

      // Instructions sheet
      const instrSheet = workbook.addWorksheet('التعليمات');
      instrSheet.views = [{ rightToLeft: true }];
      instrSheet.columns = [{ header: 'تعليمات الاستيراد', key: 'instr', width: 80 }];
      const instrHeader = instrSheet.getRow(1);
      instrHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      instrHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
      instrHeader.alignment = { horizontal: 'center', vertical: 'middle' };
      instrHeader.height = 28;
      const instructions = [
        'هذا القالب الرسمي لاستيراد بيانات النظام في جامعة المستقبل.',
        'الصف الأول يحتوي على أسماء الأعمدة المطلوبة — لا تقم بتعديله أو حذفه.',
        'الحقول المميزة بعلامة "إلزامي" يجب تعبئتها في كل صف.',
        'الصفوف المظللة بالأصفر هي أمثلة توضيحية — احذفها قبل رفع الملف.',
        'لا تترك صفوفاً فارغة بين البيانات.',
        'تأكد من تطابق أسماء الأعمدة مع القالب الأصلي.',
        'في حالة الكليات والأقسام الموحدة: املأ بيانات الكلية في الصف الأول،',
        'وكرر نفس رمز الكلية في الصفوف التالية مع تغيير بيانات القسم فقط.',
        'لا حاجة لتكرار بيانات العميد والهاتف لكل صف — اتركها فارغة للكلية نفسها.',
      ];
      instructions.forEach((t) => instrSheet.addRow({ instr: t }));

      // Data sheet
      const sheet = workbook.addWorksheet('البيانات');
      sheet.views = [{ rightToLeft: true }];
      sheet.columns = template.columns.map((c) => ({
        header: c.labelAr || c.key,
        key: c.key,
        width: Math.max((c.labelAr || c.key).length * 2, 22),
      }));

      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF065F46' },
      };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

      (template.sampleData || []).forEach((row) => {
        const dataRow = sheet.addRow(row);
        dataRow.eachCell((cell: any) => {
          cell.fill = { type: 'pattern' as any, pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } };
        });
      });

      // Add a separator empty row after samples
      sheet.addRow({});

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `قالب_استيراد_${selectedEntity}_جامعة_المستقبل.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Error generating Excel template:', err);
      alert('تعذر إنشاء القالب: ' + err.message);
    }
  };

  // Download Unified Department Package Excel Template (.xlsx)
  const handleDownloadPackageTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'جامعة المستقبل - Al-Mustaqbal University';
      workbook.created = new Date();

      const addStyledSheet = (
        name: string,
        columns: Array<{ header: string; key: string; width: number }>,
        data: any[]
      ) => {
        const sheet = workbook.addWorksheet(name);
        sheet.views = [{ rightToLeft: true }];
        sheet.columns = columns;
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF065F46' },
        };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
        headerRow.height = 28;
        data.forEach((item) => {
          const r = sheet.addRow(item);
          r.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } };
          });
        });
      };

      // 0. التعليمات
      const instrSheet = workbook.addWorksheet('التعليمات');
      instrSheet.views = [{ rightToLeft: true }];
      instrSheet.columns = [{ header: 'تعليمات استيراد حزمة القسم', key: 'instr', width: 80 }];
      const instrHeader = instrSheet.getRow(1);
      instrHeader.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      instrHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
      instrHeader.alignment = { horizontal: 'center', vertical: 'middle' };
      instrHeader.height = 28;
      [
        'هذا النموذج لاستيراد بيانات قسم أكاديمي كامل في ملف واحد.',
        'يحتوي الملف على 5 صفحات عمل: بيانات القسم، المراحل والشعب، الكادر التدريسي، المواد الدراسية، والجداول الأسبوعية.',
        'الصف الأول في كل ورقة يحتوي على أسماء الأعمدة — لا تعدله أو تحذفه.',
        'الصفوف المظللة بالأصفر هي أمثلة — احذفها قبل رفع الملف.',
        'في ورقة بيانات القسم: املأ صف واحد فقط بمعلومات القسم.',
        'في ورقة المراحل والشعب: اكتب رقم المرحلة واسم كل شعبة وعدد الطلاب.',
        'في ورقة الجداول: استخدم رمز المادة والبريد الإلكتروني للتدريسي ورمز القاعة.',
        'تأكد من أن الكلية برمزها موجودة مسبقاً في النظام قبل الاستيراد.',
        'إذا لم توجد مراحل، سيقوم النظام بإنشاء 4 مراحل افتراضية تلقائياً.',
      ].forEach((t) => instrSheet.addRow({ instr: t }));

      // 1. بيانات القسم
      addStyledSheet(
        'بيانات_القسم',
        [
          { header: 'رمز القسم', key: 'code', width: 16 },
          { header: 'اسم القسم بالعربية', key: 'nameAr', width: 30 },
          { header: 'اسم القسم بالإنجليزية', key: 'nameEn', width: 30 },
          { header: 'رئيس القسم', key: 'headName', width: 25 },
          { header: 'مسؤول المتابعة', key: 'monitorName', width: 22 },
          { header: 'رمز الكلية', key: 'collegeCode', width: 16 },
          { header: 'رقم الهاتف', key: 'phone', width: 20 },
          { header: 'البريد الإلكتروني', key: 'email', width: 28 },
        ],
        [
          {
            code: 'CPE',
            nameAr: 'قسم هندسة تقنيات الحاسوب',
            nameEn: 'Computer Engineering Tech Dept',
            headName: 'أ.م.د. علي جاسم الحميري',
            monitorName: 'م. أحمد خالد',
            collegeCode: 'ENG',
            phone: '+964 770 111 2233',
            email: 'cpe@uomus.edu.iq',
          },
        ]
      );

      // 2. المراحل والشعب
      addStyledSheet(
        'المراحل_والشعب',
        [
          { header: 'المرحلة', key: 'stage', width: 14 },
          { header: 'اسم الشعبة', key: 'name', width: 18 },
          { header: 'عدد الطلاب', key: 'studentCount', width: 16 },
        ],
        [
          { stage: 1, name: 'A', studentCount: 45 },
          { stage: 1, name: 'B', studentCount: 42 },
          { stage: 2, name: 'A', studentCount: 40 },
          { stage: 3, name: 'A', studentCount: 38 },
          { stage: 4, name: 'A', studentCount: 35 },
        ]
      );

      // 3. الكادر التدريسي
      addStyledSheet(
        'الكادر_التدريسي',
        [
          { header: 'الرقم الوظيفي', key: 'employeeId', width: 18 },
          { header: 'اسم التدريسي بالعربية', key: 'nameAr', width: 28 },
          { header: 'الاسم بالإنجليزية', key: 'nameEn', width: 25 },
          { header: 'اللقب العلمي', key: 'academicTitle', width: 20 },
          { header: 'التخصص', key: 'specialization', width: 24 },
          { header: 'البريد الإلكتروني', key: 'email', width: 30 },
          { header: 'رقم الهاتف', key: 'phone', width: 20 },
        ],
        [
          {
            employeeId: 'EMP-CPE-01',
            nameAr: 'أ.د. حيدر كاظم عبيد',
            nameEn: 'Prof. Dr. Haider Kadhim',
            academicTitle: 'أستاذ دكتور',
            specialization: 'هندسة تقنيات الحاسوب',
            email: 'haider.kadhim@uomus.edu.iq',
            phone: '+964 780 123 4567',
          },
          {
            employeeId: 'EMP-CPE-02',
            nameAr: 'م.د. رغد صباح حمزة',
            nameEn: 'Dr. Raghad Sabah',
            academicTitle: 'مدرس دكتور',
            specialization: 'الذكاء الاصطناعي ومعالجة الإشارات',
            email: 'raghad.sabah@uomus.edu.iq',
            phone: '+964 780 987 6543',
          },
        ]
      );

      // 4. المواد الدراسية
      addStyledSheet(
        'المواد_الدراسية',
        [
          { header: 'رمز المادة', key: 'code', width: 16 },
          { header: 'اسم المادة', key: 'nameAr', width: 30 },
          { header: 'الاسم بالإنجليزية', key: 'nameEn', width: 28 },
          { header: 'المرحلة', key: 'stage', width: 14 },
          { header: 'نوع المادة', key: 'type', width: 16 },
          { header: 'ساعات نظري', key: 'theoreticalHours', width: 16 },
          { header: 'ساعات عملي', key: 'practicalHours', width: 16 },
          { header: 'الوحدات', key: 'creditUnits', width: 14 },
        ],
        [
          {
            code: 'CPE101',
            nameAr: 'تراكيب البيانات والخوارزميات',
            nameEn: 'Data Structures and Algorithms',
            stage: 1,
            type: 'theoretical',
            theoreticalHours: 3,
            practicalHours: 2,
            creditUnits: 4,
          },
          {
            code: 'CPE102',
            nameAr: 'هندسة البرمجيات والشبكات',
            nameEn: 'Software Engineering & Networks',
            stage: 2,
            type: 'theoretical',
            theoreticalHours: 2,
            practicalHours: 2,
            creditUnits: 3,
          },
        ]
      );

      // 5. الجداول الأسبوعية
      addStyledSheet(
        'الجداول_الأسبوعية',
        [
          { header: 'اليوم', key: 'day', width: 14 },
          { header: 'وقت البدء', key: 'startTime', width: 14 },
          { header: 'وقت الانتهاء', key: 'endTime', width: 14 },
          { header: 'رمز المادة', key: 'subjectCode', width: 16 },
          { header: 'البريد الإلكتروني للتدريسي', key: 'facultyEmail', width: 30 },
          { header: 'رمز القاعة', key: 'roomCode', width: 16 },
          { header: 'المرحلة', key: 'stage', width: 14 },
          { header: 'رمز الشعبة', key: 'section', width: 16 },
          { header: 'نوع المحاضرة', key: 'lectureType', width: 16 },
        ],
        [
          {
            day: 'الأحد',
            startTime: '08:30',
            endTime: '10:30',
            subjectCode: 'CPE101',
            facultyEmail: 'haider.kadhim@uomus.edu.iq',
            roomCode: 'ENG-101',
            stage: 1,
            section: 'A',
            lectureType: 'theoretical',
          },
          {
            day: 'الإثنين',
            startTime: '10:30',
            endTime: '12:30',
            subjectCode: 'CPE102',
            facultyEmail: 'raghad.sabah@uomus.edu.iq',
            roomCode: 'ENG-LAB-1',
            stage: 2,
            section: 'A',
            lectureType: 'practical',
          },
        ]
      );

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'حزمة_القسم_الأكاديمي_جامعة_المستقبل.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Error generating package template:', err);
      alert('تعذر إنشاء نموذج حزمة القسم: ' + err.message);
    }
  };

  // Handle Multi-Sheet Excel Package Upload
  const handlePackageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingPackage(true);
    setPackageFileName(file.name);
    setPackageResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const readSheet = (keywords: string[]) => {
        const ws = workbook.worksheets.find((s) =>
          keywords.some((k) => s.name.trim().toLowerCase().includes(k.toLowerCase()))
        );
        if (!ws) return [];

        const headers: string[] = [];
        const rows: any[] = [];
        ws.eachRow((row, rowNumber) => {
          if (rowNumber === 1) {
            row.eachCell((cell, colNumber) => {
              headers[colNumber] = String(cell.value || '').trim();
            });
          } else {
            const rowData: Record<string, any> = {};
            let hasVal = false;
            row.eachCell((cell, colNumber) => {
              const h = headers[colNumber];
              if (h) {
                let val = cell.value;
                if (typeof val === 'object' && val !== null) {
                  if ('result' in val) val = (val as any).result;
                  else if ('text' in val) val = (val as any).text;
                }
                const str = val !== undefined && val !== null ? String(val).trim() : '';
                if (str) hasVal = true;
                rowData[h] = str;
              }
            });
            if (hasVal) rows.push(rowData);
          }
        });
        return rows;
      };

      // 1. Department Info
      const deptRows = readSheet(['قسم', 'department', 'بيانات', 'info']);
      const deptRow = deptRows[0] || {};
      const department = {
        code: deptRow['رمز القسم'] || deptRow.code || 'DEPT',
        nameAr: deptRow['اسم القسم بالعربية'] || deptRow.nameAr || deptRow.name || 'قسم أكاديمي جديد',
        nameEn: deptRow['اسم القسم بالإنجليزية'] || deptRow.nameEn || '',
        headName: deptRow['رئيس القسم'] || deptRow.headName || '',
        monitorName: deptRow['مسؤول المتابعة'] || deptRow.monitorName || '',
        collegeCode: deptRow['رمز الكلية'] || deptRow.collegeCode || 'ENG',
        phone: deptRow['رقم الهاتف'] || deptRow.phone || '',
        email: deptRow['البريد الإلكتروني'] || deptRow.email || '',
      };

      // 2. Stages and Sections
      const secRows = readSheet(['شعب', 'مراحل', 'sections', 'stages']);
      const stagesSet = new Set<number>();
      const stagesList: any[] = [];
      const sectionsList: any[] = [];

      secRows.forEach((r) => {
        const stageNum = parseInt(r['المرحلة'] || r.stage || r.stageNumber || '1', 10) || 1;
        if (!stagesSet.has(stageNum)) {
          stagesSet.add(stageNum);
          stagesList.push({
            yearNumber: stageNum,
            nameAr: `المرحلة ${stageNum}`,
            nameEn: `Stage ${stageNum}`,
          });
        }
        const secName = (r['اسم الشعبة'] || r['الشعبة'] || r.name || 'A').toString().trim().toUpperCase();
        sectionsList.push({
          stageNumber: stageNum,
          name: secName,
          studentCount: parseInt(r['عدد الطلاب'] || r.studentCount || '40', 10) || 40,
        });
      });

      if (stagesList.length === 0) {
        [1, 2, 3, 4].forEach((yr) =>
          stagesList.push({ yearNumber: yr, nameAr: `المرحلة ${yr}`, nameEn: `Stage ${yr}` })
        );
      }

      // 3. Faculty
      const facultyRows = readSheet(['تدريسي', 'كادر', 'faculty', 'teachers']);
      const facultyList = facultyRows
        .map((r) => ({
          employeeId: r['الرقم الوظيفي'] || r.employeeId || '',
          nameAr: r['اسم التدريسي بالعربية'] || r['اسم التدريسي'] || r.nameAr || r.name || '',
          nameEn: r['الاسم بالإنجليزية'] || r.nameEn || '',
          academicTitle: r['اللقب العلمي'] || r.academicTitle || 'مدرس',
          specialization: r['التخصص'] || r.specialization || '',
          email: r['البريد الإلكتروني'] || r.email || '',
          phone: r['رقم الهاتف'] || r.phone || '',
        }))
        .filter((f) => f.nameAr);

      // 4. Subjects
      const subjectRows = readSheet(['مادة', 'مواد', 'subjects', 'courses']);
      const subjectsList = subjectRows
        .map((r) => ({
          code: r['رمز المادة'] || r.code || '',
          nameAr: r['اسم المادة'] || r.nameAr || r.name || '',
          nameEn: r['الاسم بالإنجليزية'] || r.nameEn || '',
          stageNumber: parseInt(r['المرحلة'] || r.stageNumber || '1', 10) || 1,
          type: r['نوع المادة'] || r.type || 'theoretical',
          theoreticalHours: parseInt(r['ساعات نظري'] || r.theoreticalHours || '2', 10) || 2,
          practicalHours: parseInt(r['ساعات عملي'] || r.practicalHours || '0', 10) || 0,
          creditUnits: parseInt(r['الوحدات'] || r.creditUnits || '3', 10) || 3,
        }))
        .filter((s) => s.nameAr || s.code);

      // 5. Schedules
      const scheduleRows = readSheet(['جدول', 'جداول', 'schedules', 'timetable']);
      const schedulesList = scheduleRows
        .map((r) => ({
          day: r['اليوم'] || r.day || '',
          startTime: r['وقت البدء'] || r.startTime || '',
          endTime: r['وقت الانتهاء'] || r.endTime || '',
          subjectCode: r['رمز المادة'] || r['المادة'] || r.subjectCode || '',
          facultyEmail: r['البريد الإلكتروني للتدريسي'] || r['التدريسي'] || r.facultyEmail || '',
          roomCode: r['رمز القاعة'] || r['القاعة'] || r.roomCode || '',
          stageNumber: parseInt(r['المرحلة'] || r.stageNumber || '1', 10) || 1,
          sectionNames: r['رمز الشعبة'] || r['الشعبة'] || r['الشعب'] || r.sectionNames || 'A',
          lectureType: r['نوع المحاضرة'] || r.lectureType || 'theoretical',
        }))
        .filter((sc) => sc.day && sc.startTime);

      setParsedPackage({
        department,
        stages: stagesList,
        sections: sectionsList,
        faculty: facultyList,
        subjects: subjectsList,
        schedules: schedulesList,
      });
    } catch (err: any) {
      alert(`خطأ في قراءة ملف حزمة القسم: ${err.message || 'تأكد من صيغة الملف'}`);
    } finally {
      setIsProcessingPackage(false);
      e.target.value = '';
    }
  };

  // Run Package Dry Run Validation
  const handleRunPackageDryRun = async () => {
    if (!parsedPackage) return;
    setIsPackageDryRunning(true);
    setPackageResult(null);
    try {
      const res = await api.importDepartmentPackage(parsedPackage, { dryRun: true });
      setPackageResult({
        success: true,
        dryRun: true,
        message: res.message || 'تم فحص ملف حزمة القسم بنجاح. البيانات سليمة ومطابقة.',
        stats: res.stats,
      });
    } catch (err: any) {
      setPackageResult({
        success: false,
        dryRun: true,
        message: err.message || 'فشلت عملية التحقق المسبق لحزمة القسم.',
        errors: err.data?.errors || [],
      });
    } finally {
      setIsPackageDryRunning(false);
    }
  };

  // Run Real Atomic Package Import
  const handleRunPackageImport = async () => {
    if (!parsedPackage) return;
    setIsPackageImporting(true);
    setPackageResult(null);
    try {
      const res = await api.importDepartmentPackage(parsedPackage, { dryRun: false });
      setPackageResult({
        success: true,
        dryRun: false,
        message: res.message || 'تم استيراد حزمة القسم الأكاديمي بنجاح تام وبشكل ذري.',
        stats: res.stats,
      });
      setParsedPackage(null);
      setPackageFileName('');
    } catch (err: any) {
      setPackageResult({
        success: false,
        dryRun: false,
        message: err.message || 'فشل استيراد حزمة القسم وتم التراجع الذري التام (Rollback).',
        errors: err.data?.errors || [],
      });
    } finally {
      setIsPackageImporting(false);
    }
  };

  // Export Department Package to Excel (.xlsx)
  const handleExportDepartmentToExcel = async () => {
    if (!selectedExportDeptId) {
      alert('يرجى اختيار القسم المراد تصديره');
      return;
    }
    setIsExportingDept(true);
    try {
      const data = await api.exportDepartmentPackage(selectedExportDeptId);
      const { department, stages, sections, faculty, subjects, schedules } = data;

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'جامعة المستقبل - Al-Mustaqbal University';
      workbook.created = new Date();

      const addStyledSheet = (
        sheetName: string,
        headers: Array<{ key: string; label: string; width?: number }>,
        rows: any[]
      ) => {
        const sheet = workbook.addWorksheet(sheetName);
        sheet.views = [{ rightToLeft: true }];
        sheet.columns = headers.map((h) => ({ header: h.label, key: h.key, width: h.width || 22 }));
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF065F46' },
        };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
        headerRow.height = 26;
        (rows || []).forEach((r) => sheet.addRow(r));
      };

      // 1. بيانات القسم
      addStyledSheet(
        'بيانات_القسم',
        [
          { key: 'code', label: 'رمز القسم', width: 16 },
          { key: 'nameAr', label: 'اسم القسم بالعربية', width: 30 },
          { key: 'nameEn', label: 'اسم القسم بالإنجليزية', width: 30 },
          { key: 'headName', label: 'رئيس القسم', width: 24 },
          { key: 'monitorName', label: 'مسؤول المتابعة', width: 22 },
          { key: 'collegeCode', label: 'رمز الكلية', width: 16 },
          { key: 'phone', label: 'رقم الهاتف', width: 20 },
          { key: 'email', label: 'البريد الإلكتروني', width: 28 },
        ],
        [department]
      );

      // 2. المراحل والشعب
      const stageSecRows = (sections || []).map((sec: any) => {
        const stg = (stages || []).find((s: any) => s.id === sec.stageId);
        return {
          stageNumber: stg?.yearNumber || 1,
          name: sec.name,
          studentCount: sec.studentCount,
        };
      });
      addStyledSheet(
        'المراحل_والشعب',
        [
          { key: 'stageNumber', label: 'المرحلة', width: 14 },
          { key: 'name', label: 'اسم الشعبة', width: 18 },
          { key: 'studentCount', label: 'عدد الطلاب', width: 16 },
        ],
        stageSecRows
      );

      // 3. الكادر التدريسي
      addStyledSheet(
        'الكادر_التدريسي',
        [
          { key: 'employeeId', label: 'الرقم الوظيفي', width: 18 },
          { key: 'nameAr', label: 'اسم التدريسي بالعربية', width: 28 },
          { key: 'academicTitle', label: 'اللقب العلمي', width: 20 },
          { key: 'specialization', label: 'التخصص', width: 24 },
          { key: 'email', label: 'البريد الإلكتروني', width: 30 },
          { key: 'phone', label: 'رقم الهاتف', width: 20 },
        ],
        faculty
      );

      // 4. المواد الدراسية
      const subjRows = (subjects || []).map((s: any) => {
        const stg = (stages || []).find((st: any) => st.id === s.stageId);
        return {
          code: s.code,
          nameAr: s.nameAr,
          nameEn: s.nameEn,
          stageNumber: stg?.yearNumber || 1,
          type: s.type,
          theoreticalHours: s.theoreticalHours,
          practicalHours: s.practicalHours,
          creditUnits: s.creditUnits,
        };
      });
      addStyledSheet(
        'المواد_الدراسية',
        [
          { key: 'code', label: 'رمز المادة', width: 16 },
          { key: 'nameAr', label: 'اسم المادة', width: 30 },
          { key: 'stageNumber', label: 'المرحلة', width: 14 },
          { key: 'type', label: 'نوع المادة', width: 16 },
          { key: 'theoreticalHours', label: 'ساعات نظري', width: 14 },
          { key: 'practicalHours', label: 'ساعات عملي', width: 14 },
          { key: 'creditUnits', label: 'الوحدات', width: 12 },
        ],
        subjRows
      );

      // 5. الجداول الأسبوعية
      addStyledSheet(
        'الجداول_الأسبوعية',
        [
          { key: 'day', label: 'اليوم', width: 14 },
          { key: 'startTime', label: 'وقت البدء', width: 14 },
          { key: 'endTime', label: 'وقت الانتهاء', width: 14 },
          { key: 'subjectCode', label: 'رمز المادة', width: 16 },
          { key: 'subjectName', label: 'اسم المادة', width: 26 },
          { key: 'facultyName', label: 'اسم التدريسي', width: 24 },
          { key: 'roomCode', label: 'رمز القاعة', width: 16 },
          { key: 'stageNumber', label: 'المرحلة', width: 14 },
          { key: 'lectureType', label: 'نوع المحاضرة', width: 16 },
        ],
        schedules
      );

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = url;
      downloadAnchor.download = `حزمة_قسم_${department?.nameAr || 'القسم'}_جامعة_المستقبل.xlsx`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`فشل تصدير حزمة القسم: ${err.message || 'خطأ غير متوقع'}`);
    } finally {
      setIsExportingDept(false);
    }
  };



  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Banner */}
      <div className="bg-gradient-to-l from-emerald-900 via-emerald-800 to-teal-950 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-emerald-700/50">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-200 text-xs font-semibold mb-3 border border-emerald-400/30">
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
            محرك الاستيراد الذري المعتمد لجامعة المستقبل (Atomic Rollback Engine)
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            مركز الاستيراد والتهيئة الأكاديمية الذكية
          </h1>
          <p className="mt-2 text-emerald-100 text-sm sm:text-base leading-relaxed">
            بوابة الإدخال والتهيئة الجماعية للكليات، الأقسام، الكادر التدريسي، المواد الدراسية، والجداول الأسبوعية.
            تعتمد المنظومة تقنية <strong>المعاملات الذرية (Atomic Transactions)</strong> لضمان حماية قواعد البيانات والتراجع الفوري عن أي عملية تحتوي أخطاء.
          </p>
        </div>
      </div>

      {/* Main Tab Switcher */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl px-3 pt-2 shadow-xs">
        <button
          onClick={() => setActiveTab('entity')}
          className={`flex items-center gap-2 px-5 py-3 font-bold text-sm border-b-2 transition-all cursor-pointer ${
            activeTab === 'entity'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          استيراد الكيانات المستقلة (الجداول، الكادر، الكليات...)
        </button>

        <button
          onClick={() => setActiveTab('package')}
          className={`flex items-center gap-2 px-5 py-3 font-bold text-sm border-b-2 transition-all cursor-pointer ${
            activeTab === 'package'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          حزمة القسم الأكاديمي الشاملة (ملف Excel)
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-5 py-3 font-bold text-sm border-b-2 transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          سجل عمليات الاستيراد السابقة
        </button>
      </div>

      {/* TAB 1: ENTITY IMPORT */}
      {activeTab === 'entity' && (
        <div className="space-y-6">
          {/* Entity Selection Grid */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 mb-1">اختر الكيان المراد استيراده</h3>
            <p className="text-xs text-slate-500 mb-4">
              حدد نوع البيانات المطلوب تحميلها وفق صلاحيات حسابك ({currentRole})
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {availableEntities.map((ent) => {
                const Icon = ent.icon;
                const isSelected = selectedEntity === ent.type;
                return (
                  <button
                    key={ent.type}
                    onClick={() => {
                      setSelectedEntity(ent.type);
                      setParsedData([]);
                      setImportResult(null);
                    }}
                    className={`flex flex-col items-start p-3.5 rounded-xl border text-right transition-all cursor-pointer ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/70 shadow-xs ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2.5 ${
                        isSelected
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="font-bold text-sm text-slate-900">{ent.title}</div>
                    <div className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-tight">
                      {ent.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Template Info & Action Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md mb-1">
                  <Info className="w-3.5 h-3.5 text-emerald-600" />
                  القالب المعتمد: {ENTITIES.find((e) => e.type === selectedEntity)?.title}
                </div>
                <h4 className="text-sm font-bold text-slate-800">
                  الأعمدة المطلوبة والصيغة القياسية لملف الاستيراد
                </h4>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleDownloadExcelTemplate}
                  disabled={loadingTemplate || !template}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
                  تحميل نموذج Excel (.xlsx)
                </button>

                <button
                  onClick={handleDownloadTemplate}
                  disabled={loadingTemplate || !template}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  تحميل نموذج CSV
                </button>

                <button
                  onClick={handleLoadSampleData}
                  disabled={loadingTemplate || !template}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold transition-all border border-emerald-200 cursor-pointer disabled:opacity-50"
                >
                  <FileCode className="w-4 h-4 text-emerald-600" />
                  تعبئة نموذج تجريبي جاهز
                </button>
              </div>
            </div>

            {/* Template Column Chips */}
            {loadingTemplate ? (
              <div className="py-4 text-center text-xs text-slate-400">جاري قراءة بنية القالب...</div>
            ) : template?.columns ? (
              <div>
                <div className="text-xs text-slate-500 mb-2 font-medium">الحقول المعترف بها في النظام:</div>
                <div className="flex flex-wrap gap-2">
                  {template.columns.map((col) => (
                    <div
                      key={col.key}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 ${
                        col.required
                          ? 'bg-amber-50 border-amber-200 text-amber-900 font-semibold'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <span>{col.labelAr}</span>
                      <span className="text-[10px] text-slate-400 font-mono">({col.key})</span>
                      {col.required && (
                        <span className="text-[10px] bg-amber-200/80 text-amber-950 px-1 rounded-sm">إلزامي</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Upload & Input Area */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">إدخال البيانات للتحليل والمعاينة</h3>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button
                  onClick={() => setInputMode('file')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    inputMode === 'file'
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  رفع ملف (Excel / CSV)
                </button>
                <button
                  onClick={() => setInputMode('paste')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    inputMode === 'paste'
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  لصق مباشر (نص جدولي / CSV)
                </button>
              </div>
            </div>

            {inputMode === 'file' ? (
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center hover:border-emerald-400 transition-colors bg-slate-50/50">
                <input
                  type="file"
                  id="import-file-input"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="import-file-input"
                  className="cursor-pointer flex flex-col items-center justify-center"
                >
                  <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-3 shadow-xs">
                    {isProcessingFile ? (
                      <RefreshCw className="w-6 h-6 animate-spin text-emerald-700" />
                    ) : (
                      <Upload className="w-6 h-6 text-emerald-700" />
                    )}
                  </div>
                  <div className="font-bold text-slate-800 text-base">
                    اضغط هنا لاختيار ملف أو اسحب الملف وأفلته
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    يدعم ملفات Excel (.xlsx, .xls) و CSV (بترميز UTF-8)
                  </div>
                  {fileName && (
                    <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-900 text-xs font-bold rounded-lg">
                      <Check className="w-3.5 h-3.5 text-emerald-700" />
                      الملف المحمل: {fileName}
                    </div>
                  )}
                </label>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="الصق هنا بيانات جدولية أو CSV (نسخ مباشر من جدول Excel)..."
                  rows={6}
                  className="w-full p-4 rounded-xl border border-slate-200 font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleParseText}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                  >
                    معاينة وتحليل النص المدخل
                  </button>
                </div>
              </div>
            )}

            {/* Data Preview Table */}
            {parsedData.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">
                      معاينة البيانات قبل الحفظ ({parsedData.length} سجل جاهز)
                    </span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      hasValidated && validationErrors.length === 0
                        ? 'bg-emerald-100 text-emerald-900'
                        : hasValidated && validationErrors.length > 0
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {hasValidated
                        ? validationErrors.length === 0
                          ? `صحيح (${parsedData.length} سجل)`
                          : `${validationErrors.length} خطأ`
                        : 'بانتظار الفحص'}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setParsedData([]);
                      setFileName('');
                      setImportResult(null);
                    }}
                    className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    مسح المعاينة
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-72">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 sticky top-0 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5 w-12 text-center">#</th>
                        {Object.keys(parsedData[0] || {}).map((header) => (
                          <th key={header} className="p-2.5 whitespace-nowrap">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {parsedData.slice(0, 15).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="p-2 text-center text-slate-400 font-mono font-bold">{idx + 1}</td>
                          {Object.keys(parsedData[0] || {}).map((header) => (
                            <td key={header} className="p-2 whitespace-nowrap text-slate-800">
                              {String(row[header] !== undefined && row[header] !== null ? row[header] : '—')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {parsedData.length > 15 && (
                  <div className="text-[11px] text-slate-400 text-center font-medium">
                    يتم عرض أول 15 سجلاً من أصل {parsedData.length} سجلاً في الملف.
                  </div>
                )}

                {/* Validation Results Panel */}
                {hasValidated && validationErrors.length > 0 && (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-700" />
                      <span className="font-bold text-amber-950 text-sm">
                        تم اكتشاف {validationErrors.length} خطأ في البيانات — يجب تصحيحها قبل الاستيراد
                      </span>
                    </div>
                    <div className="max-h-40 overflow-y-auto bg-white rounded-lg border border-amber-200 divide-y divide-amber-100">
                      {validationErrors.slice(0, 50).map((err, i) => (
                        <div key={i} className="p-2 text-xs flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-md font-mono text-[11px]">
                              الصف {err.row}
                            </span>
                            <span className="font-semibold text-slate-800">الحقل: {err.field}</span>
                          </div>
                          <div className="text-amber-700 font-medium">{err.message}</div>
                        </div>
                      ))}
                      {validationErrors.length > 50 && (
                        <div className="p-2 text-[11px] text-center text-amber-600 font-medium">
                          ... و {validationErrors.length - 50} خطأ آخر
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {hasValidated && validationErrors.length === 0 && parsedData.length > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                    <span className="text-sm font-bold text-emerald-950">
                      تم فحص جميع السجلات بنجاح — البيانات جاهزة للاستيراد
                    </span>
                  </div>
                )}

                {/* Atomic Guarantee Note & Execute Button */}
                <div className={`rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  hasValidated && validationErrors.length > 0
                    ? 'bg-slate-100 border border-slate-300'
                    : 'bg-emerald-50/70 border border-emerald-200'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-200/60 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                      <ShieldCheck className="w-5 h-5 text-emerald-800" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-emerald-950">
                        الضمان الذري للتراجع التام (Atomic Transaction Rollback)
                      </div>
                      <div className="text-[11px] text-emerald-800 leading-relaxed mt-0.5">
                        سيتم فحص كافة السجلات في معاملة بنكية ذرية واحدة. في حال حدوث أي خطأ في أي صف،
                        يتم إلغاء العملية بأكملها ولن يتغير أي سجل في النظام.
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleExecuteImport}
                    disabled={isImporting || (hasValidated && validationErrors.length > 0)}
                    className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-extrabold text-sm transition-all shadow-md shrink-0 ${
                      hasValidated && validationErrors.length > 0
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                        : 'bg-emerald-800 hover:bg-emerald-900 text-white cursor-pointer disabled:opacity-50'
                    }`}
                    title={hasValidated && validationErrors.length > 0 ? 'صحح الأخطاء أولاً قبل الاستيراد' : 'بدء الاستيراد'}
                  >
                    {isImporting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        جاري التنفيذ والفحص...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                        بدء الاستيراد الذري الآن ({parsedData.length} سجل)
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Results or Errors Banner */}
            {importResult && (
              <div
                className={`rounded-2xl p-5 border shadow-xs space-y-3 ${
                  importResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-rose-50 border-rose-200 text-rose-950'
                }`}
              >
                <div className="flex items-start gap-3">
                  {importResult.success ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <h4 className="font-bold text-sm">
                      {importResult.success ? 'اكتملت عملية الاستيراد بنجاح تام' : 'تعذر إتمام الاستيراد — تم التراجع التام'}
                    </h4>
                    <p className="text-xs mt-1 leading-relaxed">{importResult.message}</p>

                    {importResult.success && (
                      <div className="mt-3 flex flex-wrap gap-4 text-xs font-bold">
                        <div className="bg-emerald-100 text-emerald-900 px-3 py-1.5 rounded-lg">
                          السجلات المنشأة حديثاً: {importResult.created ?? 0}
                        </div>
                        <div className="bg-emerald-100 text-emerald-900 px-3 py-1.5 rounded-lg">
                          السجلات المحدثة: {importResult.updated ?? 0}
                        </div>
                        {importResult.jobId && (
                          <div className="bg-white/70 text-slate-700 px-3 py-1.5 rounded-lg border border-emerald-200 font-mono text-[11px]">
                            معرف العملية: {importResult.jobId}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Error Rows Table if Rollback */}
                {importResult.errors && importResult.errors.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-rose-200">
                    <div className="font-bold text-xs text-rose-900 mb-2">
                      تفاصيل الأخطاء المكتشفة التي تسببت في التراجع ({importResult.errors.length} خطأ):
                    </div>
                    <div className="max-h-48 overflow-y-auto bg-white rounded-xl border border-rose-200 divide-y divide-rose-100">
                      {importResult.errors.map((err, i) => (
                        <div key={i} className="p-2.5 text-xs flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-md font-mono text-[11px]">
                              الصف {err.row}
                            </span>
                            <span className="font-semibold text-slate-800">الحقل: {err.field}</span>
                          </div>
                          <div className="text-rose-700 font-medium">{err.message}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DEPARTMENT PACKAGE (EXCEL) */}
      {activeTab === 'package' && (
        <div className="space-y-6">
          {/* Package Header Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 text-xs font-bold mb-2">
                  <Layers className="w-4 h-4 text-emerald-700" />
                  حزمة القسم الأكاديمي الشاملة المعتمدة على Excel (.xlsx)
                </div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  استيراد وتصدير حزمة القسم الأكاديمي الموحدة
                </h3>
                <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                  تتيح لك هذه المنظومة التعامل الكامل مع كافة بيانات القسم الأكاديمي (بيانات القسم، المراحل، الشعب الدراسية، الكادر التدريسي، المواد والمناهج، والجداول الأسبوعية) من خلال ملف Excel واحد يحتوي على صفحات عمل مستقلة، وبمعاملة ذرية آمنة (Atomic Rollback).
                </p>
              </div>

              {/* Template Download Button */}
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <button
                  onClick={handleDownloadPackageTemplate}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4 text-emerald-300" />
                  تحميل نموذج حزمة القسم Excel (.xlsx)
                </button>
              </div>
            </div>

            {/* Export Section */}
            <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">تصدير حزمة قسم أكاديمي حالي إلى Excel</h4>
                  <p className="text-[11px] text-slate-500">
                    توليد ملف Excel متكامل يحتوي على كافة مراحل وتدريسيي ومواد وجداول القسم المختار
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={selectedExportDeptId}
                  onChange={(e) => setSelectedExportDeptId(e.target.value)}
                  className="text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  {allDepartments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nameAr} ({d.code})
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleExportDepartmentToExcel}
                  disabled={isExportingDept || !selectedExportDeptId}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isExportingDept ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  ) : (
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  {isExportingDept ? 'جاري التصدير...' : 'تصدير إلى Excel (.xlsx)'}
                </button>
              </div>
            </div>
          </div>

          {/* Upload Package Excel Area */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">رفع ملف حزمة القسم (ملف Excel متعدد الأوراق)</h3>
              <span className="text-xs text-slate-500 font-medium">صيغة الملف المدعومة: .xlsx, .xls فقط</span>
            </div>

            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center hover:border-emerald-400 transition-colors bg-slate-50/50">
              <input
                type="file"
                id="package-file-input"
                accept=".xlsx, .xls"
                onChange={handlePackageFileUpload}
                className="hidden"
              />
              <label htmlFor="package-file-input" className="cursor-pointer flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-3 shadow-xs">
                  {isProcessingPackage ? (
                    <RefreshCw className="w-6 h-6 animate-spin text-emerald-700" />
                  ) : (
                    <Upload className="w-6 h-6 text-emerald-700" />
                  )}
                </div>
                <div className="font-bold text-slate-800 text-base">
                  اضغط هنا لاختيار ملف حزمة القسم الأكاديمي أو اسحبه وأفلته
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  يقرأ النظام تلقائياً أوراق العمل: بيانات_القسم، المراحل_والشعب، الكادر_التدريسي، المواد_الدراسية، الجداول_الأسبوعية
                </div>
                {packageFileName && (
                  <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-900 text-xs font-bold rounded-lg">
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                    الملف المختار: {packageFileName}
                  </div>
                )}
              </label>
            </div>

            {/* Parsed Package Preview */}
            {parsedPackage && (
              <div className="space-y-6 pt-4 border-t border-slate-100">
                {/* Stats Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-right">
                    <div className="text-[11px] text-emerald-800 font-bold">القسم الأكاديمي</div>
                    <div className="text-sm font-extrabold text-emerald-950 mt-1 truncate" title={parsedPackage.department?.nameAr}>
                      {parsedPackage.department?.nameAr || '—'}
                    </div>
                    <div className="text-[10px] text-emerald-700 font-mono mt-0.5">{parsedPackage.department?.code}</div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-right">
                    <div className="text-[11px] text-blue-800 font-bold">المراحل الدراسية</div>
                    <div className="text-xl font-extrabold text-blue-950 mt-1">{parsedPackage.stages?.length || 0}</div>
                    <div className="text-[10px] text-blue-700 mt-0.5">مرحلة دراسية</div>
                  </div>

                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-right">
                    <div className="text-[11px] text-indigo-800 font-bold">الشعب المكتشفة</div>
                    <div className="text-xl font-extrabold text-indigo-950 mt-1">{parsedPackage.sections?.length || 0}</div>
                    <div className="text-[10px] text-indigo-700 mt-0.5">شعبة طلابية</div>
                  </div>

                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-right">
                    <div className="text-[11px] text-purple-800 font-bold">الكادر التدريسي</div>
                    <div className="text-xl font-extrabold text-purple-950 mt-1">{parsedPackage.faculty?.length || 0}</div>
                    <div className="text-[10px] text-purple-700 mt-0.5">تدريسي مسجل</div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-right">
                    <div className="text-[11px] text-amber-800 font-bold">المواد والمناهج</div>
                    <div className="text-xl font-extrabold text-amber-950 mt-1">{parsedPackage.subjects?.length || 0}</div>
                    <div className="text-[10px] text-amber-700 mt-0.5">مادة دراسية</div>
                  </div>

                  <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-right">
                    <div className="text-[11px] text-teal-800 font-bold">المحاضرات والجداول</div>
                    <div className="text-xl font-extrabold text-teal-950 mt-1">{parsedPackage.schedules?.length || 0}</div>
                    <div className="text-[10px] text-teal-700 mt-0.5">محاضرة أسبوعية</div>
                  </div>
                </div>

                {/* Sub-tab Navigation */}
                <div className="flex border-b border-slate-200 bg-slate-50 p-1.5 rounded-xl gap-1">
                  <button
                    onClick={() => setPackagePreviewTab('dept')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      packagePreviewTab === 'dept' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    بيانات القسم
                  </button>
                  <button
                    onClick={() => setPackagePreviewTab('stages')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      packagePreviewTab === 'stages' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    المراحل والشعب ({parsedPackage.sections?.length || 0})
                  </button>
                  <button
                    onClick={() => setPackagePreviewTab('faculty')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      packagePreviewTab === 'faculty' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    الكادر التدريسي ({parsedPackage.faculty?.length || 0})
                  </button>
                  <button
                    onClick={() => setPackagePreviewTab('subjects')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      packagePreviewTab === 'subjects' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    المواد الدراسية ({parsedPackage.subjects?.length || 0})
                  </button>
                  <button
                    onClick={() => setPackagePreviewTab('schedules')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      packagePreviewTab === 'schedules' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    الجداول الأسبوعية ({parsedPackage.schedules?.length || 0})
                  </button>
                </div>

                {/* Sub-tab Content Table */}
                <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-64">
                  {packagePreviewTab === 'dept' && (
                    <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs bg-white">
                      <div><span className="text-slate-400">اسم القسم:</span> <strong className="text-slate-900 block">{parsedPackage.department?.nameAr}</strong></div>
                      <div><span className="text-slate-400">رمز القسم:</span> <strong className="text-slate-900 block font-mono">{parsedPackage.department?.code}</strong></div>
                      <div><span className="text-slate-400">رئيس القسم:</span> <strong className="text-slate-900 block">{parsedPackage.department?.headName || '—'}</strong></div>
                      <div><span className="text-slate-400">مسؤول المتابعة:</span> <strong className="text-slate-900 block">{parsedPackage.department?.monitorName || '—'}</strong></div>
                      <div><span className="text-slate-400">رمز الكلية:</span> <strong className="text-slate-900 block font-mono">{parsedPackage.department?.collegeCode || 'ENG'}</strong></div>
                      <div><span className="text-slate-400">البريد الإلكتروني:</span> <strong className="text-slate-900 block font-mono">{parsedPackage.department?.email || '—'}</strong></div>
                      <div><span className="text-slate-400">رقم الهاتف:</span> <strong className="text-slate-900 block font-mono">{parsedPackage.department?.phone || '—'}</strong></div>
                    </div>
                  )}

                  {packagePreviewTab === 'stages' && (
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr><th className="p-2.5">المرحلة</th><th className="p-2.5">اسم الشعبة</th><th className="p-2.5">عدد الطلاب</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {(parsedPackage.sections || []).map((sec, idx) => (
                          <tr key={idx} className="hover:bg-slate-50"><td className="p-2">المرحلة {sec.stageNumber}</td><td className="p-2 font-bold text-emerald-800">{sec.name}</td><td className="p-2 font-mono">{sec.studentCount} طالب</td></tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {packagePreviewTab === 'faculty' && (
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr><th className="p-2.5">الرقم الوظيفي</th><th className="p-2.5">اسم التدريسي</th><th className="p-2.5">اللقب العلمي</th><th className="p-2.5">التخصص</th><th className="p-2.5">البريد الرسمي</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {(parsedPackage.faculty || []).map((fac, idx) => (
                          <tr key={idx} className="hover:bg-slate-50"><td className="p-2 font-mono">{fac.employeeId || '—'}</td><td className="p-2 font-bold text-slate-900">{fac.nameAr}</td><td className="p-2 text-slate-600">{fac.academicTitle}</td><td className="p-2 text-slate-600">{fac.specialization || '—'}</td><td className="p-2 font-mono text-[11px] text-slate-500">{fac.email}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {packagePreviewTab === 'subjects' && (
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr><th className="p-2.5">رمز المادة</th><th className="p-2.5">اسم المادة</th><th className="p-2.5">المرحلة</th><th className="p-2.5">نوع المادة</th><th className="p-2.5">ساعات نظري</th><th className="p-2.5">ساعات عملي</th><th className="p-2.5">الوحدات</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {(parsedPackage.subjects || []).map((subj, idx) => (
                          <tr key={idx} className="hover:bg-slate-50"><td className="p-2 font-mono font-bold text-slate-800">{subj.code}</td><td className="p-2 font-medium">{subj.nameAr}</td><td className="p-2">المرحلة {subj.stageNumber}</td><td className="p-2">{subj.type}</td><td className="p-2 font-mono text-center">{subj.theoreticalHours}</td><td className="p-2 font-mono text-center">{subj.practicalHours}</td><td className="p-2 font-mono text-center font-bold text-emerald-700">{subj.creditUnits}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {packagePreviewTab === 'schedules' && (
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr><th className="p-2.5">اليوم</th><th className="p-2.5">التوقيت</th><th className="p-2.5">المادة</th><th className="p-2.5">التدريسي</th><th className="p-2.5">القاعة</th><th className="p-2.5">المرحلة والشعبة</th><th className="p-2.5">النوع</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {(parsedPackage.schedules || []).map((sch, idx) => (
                          <tr key={idx} className="hover:bg-slate-50"><td className="p-2 font-bold text-slate-800">{sch.day}</td><td className="p-2 font-mono text-slate-700" dir="ltr">{sch.startTime} - {sch.endTime}</td><td className="p-2 font-medium">{sch.subjectCode}</td><td className="p-2 font-mono text-[11px] text-slate-600">{sch.facultyEmail}</td><td className="p-2 font-bold text-emerald-800">{sch.roomCode}</td><td className="p-2">المرحلة {sch.stageNumber} ({sch.sectionNames})</td><td className="p-2">{sch.lectureType}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Atomic Guarantee & Action Buttons */}
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-200/60 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                      <ShieldCheck className="w-5 h-5 text-emerald-800" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-emerald-950">
                        الضمان الذري لحزمة القسم (Atomic Department Transaction)
                      </div>
                      <div className="text-[11px] text-emerald-800 leading-relaxed mt-0.5">
                        سيتم حفظ القسم، المراحل، الشعب، التدريسيين، المواد والجداول في معاملة واحدة مترابطة. في حال وجود تعارض أو خطأ يتم التراجع التام لحماية قاعدة البيانات.
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      onClick={handleRunPackageDryRun}
                      disabled={isPackageDryRunning || isPackageImporting}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-900 font-bold text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {isPackageDryRunning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                      فحص ومطابقة البيانات (Dry Run)
                    </button>

                    <button
                      onClick={handleRunPackageImport}
                      disabled={isPackageImporting || isPackageDryRunning}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isPackageImporting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          جاري الاستيراد الذري...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                          تنفيذ الاستيراد الذري للحزمة
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        setParsedPackage(null);
                        setPackageFileName('');
                        setPackageResult(null);
                      }}
                      className="p-2.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="مسح الحزمة"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Package Result Banner */}
            {packageResult && (
              <div
                className={`rounded-2xl p-5 border shadow-xs space-y-3 ${
                  packageResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-rose-50 border-rose-200 text-rose-950'
                }`}
              >
                <div className="flex items-start gap-3">
                  {packageResult.success ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <h4 className="font-bold text-sm">
                      {packageResult.success
                        ? packageResult.dryRun
                          ? 'نجاح الفحص المسبق لحزمة القسم'
                          : 'تم استيراد حزمة القسم الأكاديمي بنجاح'
                        : 'تعذر استيراد حزمة القسم — تم التراجع الذري'}
                    </h4>
                    <p className="text-xs mt-1 leading-relaxed">{packageResult.message}</p>

                    {packageResult.stats && (
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                        {packageResult.stats.stages !== undefined && (
                          <span className="bg-emerald-100 text-emerald-900 px-2.5 py-1 rounded-lg">
                            المراحل: {packageResult.stats.stages}
                          </span>
                        )}
                        {packageResult.stats.sections !== undefined && (
                          <span className="bg-emerald-100 text-emerald-900 px-2.5 py-1 rounded-lg">
                            الشعب: {packageResult.stats.sections}
                          </span>
                        )}
                        {packageResult.stats.faculty !== undefined && (
                          <span className="bg-emerald-100 text-emerald-900 px-2.5 py-1 rounded-lg">
                            التدريسيين: {packageResult.stats.faculty}
                          </span>
                        )}
                        {packageResult.stats.subjects !== undefined && (
                          <span className="bg-emerald-100 text-emerald-900 px-2.5 py-1 rounded-lg">
                            المواد: {packageResult.stats.subjects}
                          </span>
                        )}
                        {packageResult.stats.schedules !== undefined && (
                          <span className="bg-emerald-100 text-emerald-900 px-2.5 py-1 rounded-lg">
                            الجداول: {packageResult.stats.schedules}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">سجل عمليات الاستيراد السابقة (Import Jobs Audit)</h3>
              <p className="text-xs text-slate-500">
                توثيق كامل للعمليات السابقة مع عدد السجلات والمستخدم المنفذ
              </p>
            </div>

            <button
              onClick={fetchHistory}
              disabled={loadingHistory}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
              تحديث السجل
            </button>
          </div>

          {loadingHistory ? (
            <div className="py-12 text-center text-xs text-slate-400">جاري تحميل سجل الاستيراد...</div>
          ) : jobsHistory.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
              لا توجد عمليات استيراد سابقة مسجلة.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">معرف العملية</th>
                    <th className="p-3">اسم الملف</th>
                    <th className="p-3">نوع الكيان</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3 text-center">المعالجة</th>
                    <th className="p-3 text-center">المنشأة</th>
                    <th className="p-3 text-center">المحدثة</th>
                    <th className="p-3">تاريخ التنفيذ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {jobsHistory.map((job) => (
                    <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono text-[11px] text-slate-600 font-bold">{job.id}</td>
                      <td className="p-3 text-slate-900 font-medium">{job.fileName || 'ملف غير مسمى'}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-semibold text-[11px]">
                          {job.importType}
                        </span>
                      </td>
                      <td className="p-3">
                        {job.status === 'COMPLETED' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold text-[11px]">
                            <CheckCircle2 className="w-3 h-3" />
                            مكتمل بنجاح
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full font-bold text-[11px]">
                            <AlertCircle className="w-3 h-3" />
                            {job.status}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-slate-700">{job.rowsProcessed}</td>
                      <td className="p-3 text-center font-mono font-bold text-emerald-700">+{job.rowsCreated}</td>
                      <td className="p-3 text-center font-mono font-bold text-blue-700">~{job.rowsUpdated}</td>
                      <td className="p-3 text-slate-500 font-mono text-[11px]">
                        {job.completedAt || job.createdAt ? new Date(job.completedAt || job.createdAt).toLocaleString('ar-IQ') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
