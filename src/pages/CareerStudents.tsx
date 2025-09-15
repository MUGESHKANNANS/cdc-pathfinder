import React, { useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ZAxis } from 'recharts';

// Accept both simple and detailed Job Vertical header
const REQUIRED_COLUMNS = [
  'S.No', 'Reg Number', 'RollNo', 'Name', 'Dept', 'Section', 'PI', 'Job Vertical', 'Job Vertical (IT, CORE, BDE)',
  '10th', '12th', 'Diploma', 'CGPA', 'CutOff', 'Training Batch', 'Gender',
  'Company 1', 'Salary (Company 1)', 'Organized By (Company 1)', 'Offer Letter Link (Company 1)', 'Join Letter Link (Company 1)',
  'Number Of Company Placed', 'Placed or Non Placed', 'Maximum Salary', 'Quota', 'Hosteller / Days scholar', 'Company Joined'
];

const TEMPLATE_HEADERS = [
  'S.No','Reg Number','RollNo','Name','Dept','Section','PI','Job Vertical (IT, CORE, BDE)','10th','12th','Diploma','CGPA','CutOff','Training Batch','Gender',
  'Company 1','Salary (Company 1)','Organized By (Company 1)','Offer Letter Link (Company 1)','Join Letter Link (Company 1)',
  'Company 2','Salary (Company 2)','Organized By (Company 2)','Offer Letter Link (Company 2)','Join Letter Link (Company 2)',
  'Company 3','Salary (Company 3)','Organized By (Company 3)','Offer Letter Link (Company 3)','Join Letter Link (Company 3)',
  'Company 4','Salary (Company 4)','Organized By (Company 4)','Offer Letter Link (Company 4)','Join Letter Link (Company 4)',
  'Company 5','Salary (Company 5)','Organized By (Company 5)','Offer Letter Link (Company 5)','Join Letter Link (Company 5)',
  'Company 6','Salary (Company 6)','Organized By (Company 6)','Offer Letter Link (Company 6)','Join Letter Link (Company 6)',
  'Company 7','Salary (Company 7)','Organized By (Company 7)','Offer Letter Link (Company 7)','Join Letter Link (Company 7)',
  'Company 8','Salary (Company 8)','Organized By (Company 8)','Offer Letter Link (Company 8)','Join Letter Link (Company 8)',
  'Company 9','Salary (Company 9)','Organized By (Company 9)','Offer Letter Link (Company 9)','Join Letter Link (Company 9)',
  'Company 10','Salary (Company 10)','Organized By (Company 10)','Offer Letter Link (Company 10)','Join Letter Link (Company 10)',
  'Number Of Company Placed','Placed or Non Placed','Maximum Salary','Quota','Hosteller / Days scholar','Company Joined'
];

const normalize = (s: string) => s?.trim().replace(/\s+/g, ' ').replace(/\u00A0/g, ' ');

interface RowData { [key: string]: any }

const CareerStudents: React.FC = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<RowData[]>([]);
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState<string>('all');
  const [placed, setPlaced] = useState<string>('all');

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
      if (ext === 'csv') {
        const text = await file.text();
        const result = Papa.parse(text, { header: true, skipEmptyLines: true });
        data = (result.data as RowData[]).map(r => Object.fromEntries(Object.entries(r).map(([k,v])=>[normalize(k), v])));
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' }) as RowData[];
        data = json.map(r => Object.fromEntries(Object.entries(r).map(([k,v])=>[normalize(k), v])));
      }

      const headers = Object.keys(data[0] || {});
      const required = REQUIRED_COLUMNS.filter(c => c.startsWith('Job Vertical') ? false : true);
      const hasJobVertical = headers.includes('Job Vertical') || headers.includes('Job Vertical (IT, CORE, BDE)');
      const missing = required.filter(c => !headers.includes(c));
      if (missing.length) {
        toast({ title: 'Validation failed', description: `Missing columns: ${[...missing, !hasJobVertical ? 'Job Vertical' : ''].filter(Boolean).join(', ')}`, variant: 'destructive' });
        return;
      }

      setRows(data);
      toast({ title: 'Upload successful', description: `${data.length} records loaded` });
    } catch (e: any) {
      toast({ title: 'Parse error', description: e.message || 'Failed to parse file', variant: 'destructive' });
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'career_student_template.xlsx');
  };

  const filtered = useMemo(() => {
    const placedKey = 'Placed or Non Placed';
    return rows.filter(r => {
      const matchesSearch = search ? (String(r['Name']).toLowerCase().includes(search.toLowerCase()) || String(r['Reg Number']).toLowerCase().includes(search.toLowerCase())) : true;
      const matchesDept = dept === 'all' ? true : String(r['Dept']) === dept;
      const isPlaced = String(r[placedKey]).toLowerCase().includes('placed');
      const matchesPlaced = placed === 'all' ? true : placed === 'placed' ? isPlaced : !isPlaced;
      return matchesSearch && matchesDept && matchesPlaced;
    });
  }, [rows, search, dept, placed]);

  const departments = useMemo(() => Array.from(new Set(rows.map(r => r['Dept']).filter(Boolean))) as string[], [rows]);

  // Analytics (20+ graphs) - compute metrics similar to CareerVisualization
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

    const get = (r: RowData, keys: string[]) => {
      for (const k of keys) if (r[k] !== undefined && r[k] !== null && r[k] !== '') return r[k];
      return undefined;
    };
    const bucketize = (values: number[], step: number) => {
      const map = new Map<string, number>();
      values.forEach(v => { if (!Number.isFinite(v)) return; const start = Math.floor(v/step)*step; const end = start+step; const key = `${start}-${end}`; map.set(key, (map.get(key)||0)+1); });
      return Array.from(map.entries()).sort((a,b)=>Number(a[0].split('-')[0]) - Number(b[0].split('-')[0])).map(([range, count])=>({ range, count }));
    };

    const placed = rows.filter(r => String(r[placedKey]).toLowerCase().includes('placed')).length;
    const nonPlaced = rows.length - placed;
    const salaries = rows.map(r => Number(r[maxSalaryKey]) || 0).filter(n => !Number.isNaN(n));
    const salary = { max: salaries.length ? Math.max(...salaries) : 0, min: salaries.length ? Math.min(...salaries) : 0, avg: salaries.length ? Math.round(salaries.reduce((a,b)=>a+b,0)/salaries.length) : 0 };
    const companyMap = new Map<number, number>();
    rows.forEach(r => { const c = Number(r[companiesCountKey]) || 0; companyMap.set(c, (companyMap.get(c)||0)+1); });
    const companiesChart = Array.from(companyMap.entries()).sort((a,b)=>a[0]-b[0]).map(([num,count])=>({ companies: String(num), students: count }));
    const cgpaData = bucketize(rows.map(r=>Number(r[cgpaKey])), 1);
    const tenthData = bucketize(rows.map(r=>Number(r[tenthKey])), 5);
    const twelfthData = bucketize(rows.map(r=>Number(r[twelfthKey])), 5);
    const diplomaData = bucketize(rows.map(r=>Number(r[diplomaKey])), 5);
    const cutoffMap = new Map<string, { placed: number; nonPlaced: number }>();
    rows.forEach(r=>{ const cutoff=String(r[cutoffKey] ?? 'NA'); const isPlaced=String(r[placedKey]).toLowerCase().includes('placed'); const curr=cutoffMap.get(cutoff)||{placed:0,nonPlaced:0}; if(isPlaced) curr.placed++; else curr.nonPlaced++; cutoffMap.set(cutoff, curr); });
    const cutoffData = Array.from(cutoffMap.entries()).map(([cutoff, v])=>({ cutoff, ...v }));
    const genderMap = new Map<string, number>(); rows.forEach(r=>{ const g=String(r[genderKey]||'NA'); genderMap.set(g,(genderMap.get(g)||0)+1); });
    const genderData = Array.from(genderMap.entries()).map(([gender,value])=>({ gender, value }));
    const jobKeyName = (r: RowData) => String(get(r, jobVerticalKeys) || 'NA');
    const jobMap = new Map<string, number>(); rows.forEach(r=>{ const j=jobKeyName(r); jobMap.set(j,(jobMap.get(j)||0)+1); });
    const jobData = Array.from(jobMap.entries()).map(([job,count])=>({ job, count }));
    const sectionMap = new Map<string, number>(); rows.forEach(r=>{ const s=String(r[sectionKey]||'NA'); sectionMap.set(s,(sectionMap.get(s)||0)+1); });
    const sectionData = Array.from(sectionMap.entries()).map(([section,value])=>({ section, value }));
    const piMap = new Map<string, number>(); rows.forEach(r=>{ const p=String(r[piKey]||'NA'); piMap.set(p,(piMap.get(p)||0)+1); });
    const piData = Array.from(piMap.entries()).map(([pi,value])=>({ pi, value }));
    const batchMap = new Map<string, number>(); rows.forEach(r=>{ const b=String(r[batchKey]||'NA'); batchMap.set(b,(batchMap.get(b)||0)+1); });
    const batchData = Array.from(batchMap.entries()).map(([batch,value])=>({ batch, value }));
    const quotaMap = new Map<string, number>(); rows.forEach(r=>{ const q=String(r[quotaKey]||'NA'); quotaMap.set(q,(quotaMap.get(q)||0)+1); });
    const quotaData = Array.from(quotaMap.entries()).map(([quota,value])=>({ quota, value }));
    const hostelMap = new Map<string, number>(); rows.forEach(r=>{ const h=String(r[hostelKey]||'NA'); hostelMap.set(h,(hostelMap.get(h)||0)+1); });
    const hostelData = Array.from(hostelMap.entries()).map(([type,value])=>({ type, value }));
    const deptMap = new Map<string, { total: number; placed: number; salarySum: number; count: number }>();
    rows.forEach(r=>{ const dept=String(r[deptKey]||'NA'); const isPlaced=String(r[placedKey]).toLowerCase().includes('placed'); const sal=Number(r[maxSalaryKey])||0; const d=deptMap.get(dept)||{ total:0, placed:0, salarySum:0, count:0 }; d.total++; if(isPlaced) d.placed++; if(Number.isFinite(sal)){ d.salarySum+=sal; d.count++; } deptMap.set(dept,d); });
    const deptData = Array.from(deptMap.entries()).map(([dept,v])=>({ dept, ratio: v.total ? Math.round((v.placed/v.total)*100) : 0 }));
    const deptAvgSalary = Array.from(deptMap.entries()).map(([dept,v])=>({ dept, avgSalary: v.count ? Math.round(v.salarySum/v.count) : 0 }));
    const compToSal = new Map<number, { sum: number; count: number }>();
    rows.forEach(r=>{ const c=Number(r[companiesCountKey])||0; const sal=Number(r[maxSalaryKey])||0; const cur=compToSal.get(c)||{sum:0,count:0}; if(Number.isFinite(sal)){ cur.sum+=sal; cur.count++; } compToSal.set(c,cur); });
    const avgSalaryByCompanies = Array.from(compToSal.entries()).sort((a,b)=>a[0]-b[0]).map(([companies,v])=>({ companies: String(companies), avgSalary: v.count ? Math.round(v.sum/v.count) : 0 }));
    const cgpaVsSalary = rows.map(r=>({ x:Number(r[cgpaKey])||0, y:Number(r[maxSalaryKey])||0 })).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
    const cutoffVsSalary = rows.map(r=>({ x:Number(r[cutoffKey])||0, y:Number(r[maxSalaryKey])||0 })).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));

    return { placed, nonPlaced, salary, companiesChart, cgpaData, tenthData, twelfthData, diplomaData, cutoffData, genderData, jobData, sectionData, piData, batchData, quotaData, hostelData, deptData, deptAvgSalary, avgSalaryByCompanies, cgpaVsSalary, cutoffVsSalary };
  }, [rows]);

  const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4', '#22c55e', '#eab308'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Career - Student List</h1>
          <p className="text-muted-foreground">Upload Excel/CSV and browse students</p>
        </div>
        <div className="flex items-center gap-2">
          <Input ref={fileRef} type="file" accept=".xlsx,.csv" onChange={(e)=>{ const f=e.target.files?.[0]; if (f) handleFile(f);} } />
          <Button variant="outline" onClick={()=>fileRef.current?.click()}>Upload</Button>
          <Button variant="outline" onClick={downloadTemplate}>Download Template</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Search Name/Reg No</Label>
            <Input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="e.g., John / 22xxx" />
          </div>
          <div className="space-y-2">
            <Label>Department</Label>
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {departments.map(d => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Placement</Label>
            <Select value={placed} onValueChange={setPlaced}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="placed">Placed</SelectItem>
                <SelectItem value="non">Non-Placed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Students ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="p-2">Reg No</th>
                  <th className="p-2">Roll No</th>
                  <th className="p-2">Name</th>
                  <th className="p-2">Dept</th>
                  <th className="p-2">CGPA</th>
                  <th className="p-2">CutOff</th>
                  <th className="p-2">Placed</th>
                  <th className="p-2">Max Salary</th>
                  <th className="p-2">Company Joined</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 500).map((r, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="p-2">{r['Reg Number']}</td>
                    <td className="p-2">{r['RollNo']}</td>
                    <td className="p-2">{r['Name']}</td>
                    <td className="p-2">{r['Dept']}</td>
                    <td className="p-2">{r['CGPA']}</td>
                    <td className="p-2">{r['CutOff']}</td>
                    <td className="p-2">{String(r['Placed or Non Placed']).toLowerCase().includes('placed') ? 'Placed' : 'Non-Placed'}</td>
                    <td className="p-2">{r['Maximum Salary']}</td>
                    <td className="p-2">{r['Company Joined'] || r['Company 1']}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Analytics (20+ charts) */}
      {rows.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Placement Overview</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="col-span-1">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie dataKey="value" data={[{ name: 'Placed', value: metrics.placed }, { name: 'Non-Placed', value: metrics.nonPlaced }]} cx="50%" cy="50%" outerRadius={80} label>
                      {[{ name: 'Placed' }, { name: 'Non-Placed' }].map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <p className="mt-2 text-xs text-muted-foreground text-center">Placed vs Non-Placed students</p>
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
                <p className="mt-2 text-xs text-muted-foreground text-center">Students by number of companies placed</p>
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
                <p className="mt-2 text-xs text-muted-foreground text-center">Minimum / Average / Maximum salary</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Academic Insights</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 lg:grid-cols-4 gap-6">
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
                <p className="mt-2 text-xs text-muted-foreground text-center">CGPA distribution</p>
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
                <p className="mt-2 text-xs text-muted-foreground text-center">10th marks distribution</p>
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
                <p className="mt-2 text-xs text-muted-foreground text-center">12th marks distribution</p>
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
                <p className="mt-2 text-xs text-muted-foreground text-center">Diploma marks distribution</p>
              </div>
            </CardContent>
          </Card>

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
                <p className="mt-2 text-xs text-muted-foreground text-center">Gender split</p>
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
                <p className="mt-2 text-xs text-muted-foreground text-center">Job vertical mix (IT / CORE / BDE)</p>
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
                <p className="mt-2 text-xs text-muted-foreground text-center">Section-wise student count</p>
              </div>
            </CardContent>
          </Card>

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
                <p className="mt-2 text-xs text-muted-foreground text-center">Placement Incharge (PI) distribution</p>
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
                <p className="mt-2 text-xs text-muted-foreground text-center">Training batch distribution</p>
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
                <p className="mt-2 text-xs text-muted-foreground text-center">Quota split</p>
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
                <p className="mt-2 text-xs text-muted-foreground text-center">Hosteller vs Day Scholar split</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Department Placement Ratio and Salary</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                <p className="mt-2 text-xs text-muted-foreground text-center">Department-wise placement ratio (%)</p>
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
                <p className="mt-2 text-xs text-muted-foreground text-center">Department-wise average salary</p>
              </div>
            </CardContent>
          </Card>

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
                <p className="mt-2 text-xs text-muted-foreground text-center">CGPA vs Maximum Salary</p>
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
                <p className="mt-2 text-xs text-muted-foreground text-center">Cutoff vs Maximum Salary</p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default CareerStudents; 