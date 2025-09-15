import React, { useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ZAxis } from 'recharts';
import { downloadNodeAsPng } from '@/lib/utils';

// Expected columns (accepts both simple and detailed job vertical header)
const REQUIRED_COLUMNS = [
  'S.No', 'Reg Number', 'RollNo', 'Name', 'Dept', 'Section', 'PI', 'Job Vertical', 'Job Vertical (IT, CORE, BDE)',
  '10th', '12th', 'Diploma', 'CGPA', 'CutOff', 'Training Batch', 'Gender',
  'Company 1 Name', 'Company 1 Salary', 'Number Of Company Placed', 'Placed or Non Placed', 'Maximum Salary', 'Quota', 'Hosteller/Day Scholar', 'Company Joined'
];

// Normalize header names helper
const normalize = (s: string) => s?.trim().replace(/\s+/g, ' ').replace(/\u00A0/g, ' ');

interface RowData {
  [key: string]: any;
}

const CareerVisualization: React.FC = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<RowData[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);

  // Role gate: cdc_director or faculty
  if (!profile || (profile.role !== 'cdc_director' && profile.role !== 'faculty')) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-destructive mb-2">Access Denied</h1>
        <p className="text-muted-foreground">Only CDC Director and Faculty can access this page.</p>
      </div>
    );
  }

  const handleFile = async (file: File) => {
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['xlsx', 'csv'].includes(ext || '')) {
        toast({ title: 'Invalid file', description: 'Please upload a .xlsx or .csv file', variant: 'destructive' });
        return;
      }

      let data: RowData[] = [];
      let fileHeaders: string[] = [];

      if (ext === 'csv') {
        const text = await file.text();
        const result = Papa.parse(text, { header: true, skipEmptyLines: true });
        const parsed = result.data as RowData[];
        data = parsed.map(r => {
          const mapped: RowData = {};
          Object.entries(r).forEach(([k, v]) => { mapped[normalize(k)] = v; });
          return mapped;
        });
        fileHeaders = Object.keys(parsed[0] || {}).map(normalize);
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' }) as RowData[];
        data = json.map(r => {
          const mapped: RowData = {};
          Object.entries(r).forEach(([k, v]) => { mapped[normalize(k)] = v; });
          return mapped;
        });
        fileHeaders = Object.keys(json[0] || {}).map(normalize);
      }

      // Validate required columns (allow at least one of the job vertical headers)
      const required = REQUIRED_COLUMNS.filter(c => c.startsWith('Job Vertical') ? false : true);
      const missing = required.filter(col => !fileHeaders.includes(col));
      const hasJobVertical = fileHeaders.includes('Job Vertical') || fileHeaders.includes('Job Vertical (IT, CORE, BDE)');
      if (missing.length || !hasJobVertical) {
        toast({ title: 'Validation failed', description: `Missing columns: ${[...missing, !hasJobVertical ? 'Job Vertical' : ''].filter(Boolean).join(', ')}`, variant: 'destructive' });
        return;
      }

      setHeaders(fileHeaders);
      setRows(data);
      toast({ title: 'Upload successful', description: `${data.length} records loaded` });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Parse error', description: e.message || 'Failed to parse file', variant: 'destructive' });
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const get = (r: RowData, keys: string[]): any => {
    for (const k of keys) {
      if (r[k] !== undefined && r[k] !== null && r[k] !== '') return r[k];
    }
    return undefined;
  };

  const bucketize = (values: number[], step: number) => {
    const map = new Map<string, number>();
    values.forEach(v => {
      if (!Number.isFinite(v)) return;
      const start = Math.floor(v / step) * step;
      const end = start + step;
      const key = `${start}-${end}`;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a,b)=>Number(a[0].split('-')[0]) - Number(b[0].split('-')[0])).map(([range, count])=>({ range, count }));
  };

  const metrics = useMemo(() => {
    const placedKey = 'Placed or Non Placed';
    const maxSalaryKey = 'Maximum Salary';
    const companiesCountKey = 'Number Of Company Placed';
    const cgpaKey = 'CGPA';
    const cutoffKey = 'CutOff';
    const genderKey = 'Gender';
    const deptKey = 'Dept';
    const jobVerticalKeys = ['Job Vertical', 'Job Vertical (IT, CORE, BDE)'];
    const tenthKey = '10th';
    const twelfthKey = '12th';
    const diplomaKey = 'Diploma';
    const sectionKey = 'Section';
    const piKey = 'PI';
    const batchKey = 'Training Batch';
    const quotaKey = 'Quota';
    const hostelKey = 'Hosteller / Days scholar';

    const placed = rows.filter(r => String(r[placedKey]).toLowerCase().includes('placed')).length;
    const nonPlaced = rows.length - placed;

    const salaries = rows.map(r => Number(r[maxSalaryKey]) || 0).filter(n => !Number.isNaN(n));
    const salary = {
      max: salaries.length ? Math.max(...salaries) : 0,
      min: salaries.length ? Math.min(...salaries) : 0,
      avg: salaries.length ? Math.round(salaries.reduce((a, b) => a + b, 0) / salaries.length) : 0,
    };

    const companyMap = new Map<number, number>();
    rows.forEach(r => {
      const c = Number(r[companiesCountKey]) || 0;
      companyMap.set(c, (companyMap.get(c) || 0) + 1);
    });
    const companiesChart = Array.from(companyMap.entries()).sort((a,b)=>a[0]-b[0]).map(([num, count]) => ({ companies: String(num), students: count }));

    const cgpaData = bucketize(rows.map(r => Number(r[cgpaKey])), 1);
    const tenthData = bucketize(rows.map(r => Number(r[tenthKey])), 5);
    const twelfthData = bucketize(rows.map(r => Number(r[twelfthKey])), 5);
    const diplomaData = bucketize(rows.map(r => Number(r[diplomaKey])), 5);

    const cutoffMap = new Map<string, { placed: number; nonPlaced: number }>();
    rows.forEach(r => {
      const cutoff = String(r[cutoffKey] ?? 'NA');
      const isPlaced = String(r[placedKey]).toLowerCase().includes('placed');
      const curr = cutoffMap.get(cutoff) || { placed: 0, nonPlaced: 0 };
      if (isPlaced) curr.placed++; else curr.nonPlaced++;
      cutoffMap.set(cutoff, curr);
    });
    const cutoffData = Array.from(cutoffMap.entries()).map(([cutoff, v]) => ({ cutoff, ...v }));

    const genderMap = new Map<string, number>();
    rows.forEach(r => { const g = String(r[genderKey] || 'NA'); genderMap.set(g, (genderMap.get(g)||0)+1); });
    const genderData = Array.from(genderMap.entries()).map(([gender, value])=>({ gender, value }));

    const jobKeyName = (r: RowData) => String(get(r, jobVerticalKeys) || 'NA');
    const jobMap = new Map<string, number>();
    rows.forEach(r => { const j = jobKeyName(r); jobMap.set(j, (jobMap.get(j)||0)+1); });
    const jobData = Array.from(jobMap.entries()).map(([job, count])=>({ job, count }));

    const sectionMap = new Map<string, number>();
    rows.forEach(r => { const s = String(r[sectionKey] || 'NA'); sectionMap.set(s, (sectionMap.get(s)||0)+1); });
    const sectionData = Array.from(sectionMap.entries()).map(([section, value])=>({ section, value }));

    const piMap = new Map<string, number>();
    rows.forEach(r => { const p = String(r[piKey] || 'NA'); piMap.set(p, (piMap.get(p)||0)+1); });
    const piData = Array.from(piMap.entries()).map(([pi, value])=>({ pi, value }));

    const batchMap = new Map<string, number>();
    rows.forEach(r => { const b = String(r[batchKey] || 'NA'); batchMap.set(b, (batchMap.get(b)||0)+1); });
    const batchData = Array.from(batchMap.entries()).map(([batch, value])=>({ batch, value }));

    const quotaMap = new Map<string, number>();
    rows.forEach(r => { const q = String(r[quotaKey] || 'NA'); quotaMap.set(q, (quotaMap.get(q)||0)+1); });
    const quotaData = Array.from(quotaMap.entries()).map(([quota, value])=>({ quota, value }));

    const hostelMap = new Map<string, number>();
    rows.forEach(r => { const h = String(r[hostelKey] || 'NA'); hostelMap.set(h, (hostelMap.get(h)||0)+1); });
    const hostelData = Array.from(hostelMap.entries()).map(([type, value])=>({ type, value }));

    // Dept placement and salary
    const deptMap = new Map<string, { total: number; placed: number; salarySum: number; count: number }>();
    rows.forEach(r => {
      const dept = String(r[deptKey] || 'NA');
      const isPlaced = String(r[placedKey]).toLowerCase().includes('placed');
      const sal = Number(r[maxSalaryKey]) || 0;
      const d = deptMap.get(dept) || { total: 0, placed: 0, salarySum: 0, count: 0 };
      d.total++; if (isPlaced) d.placed++; if (Number.isFinite(sal)) { d.salarySum += sal; d.count++; }
      deptMap.set(dept, d);
    });
    const deptData = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, ratio: v.total ? Math.round((v.placed / v.total) * 100) : 0, placed: v.placed, total: v.total }));
    const deptAvgSalary = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, avgSalary: v.count ? Math.round(v.salarySum / v.count) : 0 }));

    // Organized By aggregation across companies
    const organizedByCounts = new Map<string, number>();
    for (let i = 1; i <= 10; i++) {
      const col = `Organized By (Company ${i})`;
      rows.forEach(r => { const org = String(r[col] || ''); if (org) organizedByCounts.set(org, (organizedByCounts.get(org)||0)+1); });
    }
    const organizedByData = Array.from(organizedByCounts.entries()).map(([org, count])=>({ org, count }));

    // Offer/Join links totals
    let offerLinks = 0, joinLinks = 0;
    for (let i = 1; i <= 10; i++) {
      const oCol = `Offer Letter Link (Company ${i})`;
      const jCol = `Join Letter Link (Company ${i})`;
      rows.forEach(r => { if (r[oCol]) offerLinks++; if (r[jCol]) joinLinks++; });
    }
    const offerJoinData = [ { type: 'Offer Letters', value: offerLinks }, { type: 'Join Letters', value: joinLinks } ];

    // Average salary per # companies
    const compToSal = new Map<number, { sum: number; count: number }>();
    rows.forEach(r => {
      const c = Number(r[companiesCountKey]) || 0;
      const sal = Number(r[maxSalaryKey]) || 0;
      const curr = compToSal.get(c) || { sum: 0, count: 0 };
      if (Number.isFinite(sal)) { curr.sum += sal; curr.count++; }
      compToSal.set(c, curr);
    });
    const avgSalaryByCompanies = Array.from(compToSal.entries()).sort((a,b)=>a[0]-b[0]).map(([companies, v]) => ({ companies: String(companies), avgSalary: v.count ? Math.round(v.sum / v.count) : 0 }));

    // Scatter datasets
    const cgpaVsSalary = rows.map(r => ({ x: Number(r[cgpaKey]) || 0, y: Number(r[maxSalaryKey]) || 0 })).filter(p=>Number.isFinite(p.x) && Number.isFinite(p.y));
    const cutoffVsSalary = rows.map(r => ({ x: Number(r[cutoffKey]) || 0, y: Number(r[maxSalaryKey]) || 0 })).filter(p=>Number.isFinite(p.x) && Number.isFinite(p.y));

    return {
      placed, nonPlaced, salary, companiesChart, cgpaData, cutoffData, genderData,
      companyTable: [], // kept minimal (table exists below)
      deptData, jobData, sectionData, piData, batchData, quotaData, hostelData,
      deptAvgSalary, organizedByData, offerJoinData, tenthData, twelfthData, diplomaData,
      avgSalaryByCompanies, cgpaVsSalary, cutoffVsSalary
    };
  }, [rows]);

  const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4', '#22c55e', '#eab308'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Career Data Visualization</h1>
          <p className="text-muted-foreground">Upload Excel/CSV and view insights</p>
        </div>
        <div className="flex items-center gap-2">
          <Input ref={fileInputRef} type="file" accept=".xlsx,.csv" onChange={onFileChange} />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>Upload</Button>
        </div>
      </div>

      {/* Placement Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Placement Overview</CardTitle>
            <Button variant="outline" size="sm" onClick={() => {
              const el = document.getElementById('chart-placement-overview');
              if (el) downloadNodeAsPng(el, 'placement-overview');
            }}>Download PNG</Button>
          </div>
        </CardHeader>
        <CardContent id="chart-placement-overview" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="col-span-1">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie dataKey="value" data={[{ name: 'Placed', value: metrics.placed }, { name: 'Non-Placed', value: metrics.nonPlaced }]} cx="50%" cy="50%" outerRadius={80} label>
                  {[{ name: 'Placed' }, { name: 'Non-Placed' }].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="col-span-1">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={metrics.companiesChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="companies" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="students" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="col-span-1">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={[{ name: 'Min', value: metrics.salary.min }, { name: 'Avg', value: metrics.salary.avg }, { name: 'Max', value: metrics.salary.max }]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#10b981" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Academics: CGPA, 10th, 12th, Diploma */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Academic Insights</CardTitle>
            <Button variant="outline" size="sm" onClick={() => {
              const el = document.getElementById('chart-academics');
              if (el) downloadNodeAsPng(el, 'academic-insights');
            }}>Download PNG</Button>
          </div>
        </CardHeader>
        <CardContent id="chart-academics" className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="col-span-1">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={metrics.cgpaData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="col-span-1">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={metrics.tenthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#06b6d4" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="col-span-1">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={metrics.twelfthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="col-span-1">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={metrics.diplomaData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Demographics & Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Categories and Demographics</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="col-span-1">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie dataKey="value" data={metrics.genderData.map((g,i)=>({ name: g.gender, value: g.value }))} cx="50%" cy="50%" outerRadius={80} label>
                  {metrics.genderData.map((_, index) => (
                    <Cell key={`cell-g-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="col-span-1">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={metrics.jobData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="job" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="col-span-1">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={metrics.sectionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="section" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* PI, Batch, Quota, Hostel */}
      <Card>
        <CardHeader>
          <CardTitle>PI, Training Batch, Quota, Hostel</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="col-span-1">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={metrics.piData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="pi" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="col-span-1">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={metrics.batchData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="batch" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="col-span-1">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={metrics.quotaData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="quota" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="col-span-1">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={metrics.hostelData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#06b6d4" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Department placement ratio and avg salary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Department Placement Ratio and Salary</CardTitle>
            <Button variant="outline" size="sm" onClick={() => {
              const el = document.getElementById('chart-dept');
              if (el) downloadNodeAsPng(el, 'department-placement-salary');
            }}>Download PNG</Button>
          </div>
        </CardHeader>
        <CardContent id="chart-dept" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="col-span-1">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={metrics.deptData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="ratio" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="col-span-1">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={metrics.deptAvgSalary}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="avgSalary" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Organized By, Offers vs Join letters, Avg Salary by # Companies */}
      <Card>
        <CardHeader>
          <CardTitle>Process Insights</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="col-span-1">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={metrics.organizedByData.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="org" interval={0} angle={-30} textAnchor="end" height={60} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="col-span-1">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={metrics.offerJoinData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="col-span-1">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={metrics.avgSalaryByCompanies}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="companies" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="avgSalary" stroke="#8b5cf6" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Scatter Plots */}
      <Card>
        <CardHeader>
          <CardTitle>Correlation Plots</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="col-span-1">
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart>
                <CartesianGrid />
                <XAxis type="number" dataKey="x" name="CGPA" domain={[0, 10]} />
                <YAxis type="number" dataKey="y" name="Max Salary" />
                <ZAxis range={[60, 60]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter data={metrics.cgpaVsSalary} fill="#10b981" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="col-span-1">
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart>
                <CartesianGrid />
                <XAxis type="number" dataKey="x" name="Cutoff" />
                <YAxis type="number" dataKey="y" name="Max Salary" />
                <ZAxis range={[60, 60]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter data={metrics.cutoffVsSalary} fill="#3b82f6" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CareerVisualization; 