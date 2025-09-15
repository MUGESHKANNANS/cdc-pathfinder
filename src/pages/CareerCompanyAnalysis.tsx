import React, { useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Tooltip, ResponsiveContainer } from 'recharts';
import { downloadNodeAsPng } from '@/lib/utils';

const TEMPLATE_HEADERS = [
  'S.No','Company Name','Package','Organized','AD','AIML','BME','CSBS','CHEM','CIVIL','CSE','ECE','EEE','IT','MCT','MECH','Total'
];

const normalize = (s: string) => s?.trim().replace(/\s+/g, ' ').replace(/\u00A0/g, ' ');

interface RowData { [key: string]: any }

const CareerCompanyAnalysis: React.FC = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<RowData[]>([]);

  if (!profile || (profile.role !== 'cdc_director' && profile.role !== 'faculty')) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-destructive mb-2">Access Denied</h1>
        <p className="text-muted-foreground">Only CDC Director and Faculty can access this page.</p>
      </div>
    );
  }

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'company_analysis_template.xlsx');
  };

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

      if (!data.length) {
        toast({ title: 'No data', description: 'The file appears to be empty', variant: 'destructive' });
        return;
      }

      setRows(data);
      toast({ title: 'Upload successful', description: `${data.length} companies loaded` });
    } catch (e: any) {
      toast({ title: 'Parse error', description: e.message || 'Failed to parse file', variant: 'destructive' });
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  // Detect department columns dynamically (all headers between Company/Package/Organized and Total)
  const headers = useMemo(() => Object.keys(rows[0] || {}), [rows]);
  const departments = useMemo(() => {
    const exclude = new Set(['S.No','Company Name','Package','Organized','Total']);
    return headers.filter(h => !exclude.has(h));
  }, [headers]);

  const metrics = useMemo(() => {
    // Company totals by department and overall
    const perCompany = rows.map(r => {
      const company = String(r['Company Name'] || 'NA');
      const pkg = Number(r['Package']) || 0;
      const organized = String(r['Organized'] || 'NA');
      const deptCounts = departments.map(d => Number(r[d]) || 0);
      const total = Number(r['Total']) || deptCounts.reduce((a,b)=>a+b,0);
      return { company, pkg, organized, total, depts: Object.fromEntries(departments.map((d,i)=>[d, deptCounts[i]])) };
    });

    // Top companies by hires
    const topCompanies = [...perCompany].sort((a,b)=>b.total-a.total).slice(0, 15).map(x=>({ company: x.company, hires: x.total }));

    // Package distribution
    const pkgBuckets = new Map<string, number>();
    perCompany.forEach(c => {
      const v = c.pkg; if (!Number.isFinite(v)) return; const start = Math.floor(v/1)*1; const end = start+1; const k = `${start}-${end}`; pkgBuckets.set(k, (pkgBuckets.get(k)||0)+1);
    });
    const packageDist = Array.from(pkgBuckets.entries()).sort((a,b)=>Number(a[0].split('-')[0])-Number(b[0].split('-')[0])).map(([range,count])=>({ range, count }));

    // Organized by split
    const orgMap = new Map<string, number>();
    perCompany.forEach(c => { orgMap.set(c.organized, (orgMap.get(c.organized)||0)+1); });
    const organizedSplit = Array.from(orgMap.entries()).map(([organized, value])=>({ organized, value }));

    // Department totals
    const deptTotals = departments.map(d => ({ dept: d, hires: perCompany.reduce((sum,c)=>sum + (c.depts[d]||0), 0) }));

    // Company x Dept (stacked)
    const companyDept = perCompany.slice(0, 10).map(c => ({ company: c.company, ...c.depts }));

    // Dept share per company (percentage)
    const deptSharePerCompany = perCompany.slice(0, 10).map(c => {
      const row: any = { company: c.company };
      departments.forEach(d => { row[d] = c.total ? Math.round(((c.depts[d]||0) / c.total) * 100) : 0; });
      return row;
    });

    // Cumulative hires over companies (sorted by total)
    const sorted = [...perCompany].sort((a,b)=>b.total-a.total);
    const cumulative = sorted.map((c, idx) => ({ idx: idx+1, cumulative: sorted.slice(0, idx+1).reduce((s,x)=>s+x.total,0) }));

    // Top departments per company (category)
    const topDeptPerCompany = perCompany.slice(0, 10).map(c => {
      const entries = Object.entries(c.depts) as [string, number][];
      const [dept, hires] = entries.sort((a,b)=>b[1]-a[1])[0] || ['NA', 0];
      return { company: c.company, dept, hires };
    });

    // Average package by organizer
    const orgToPkg = new Map<string, { sum: number; count: number }>();
    perCompany.forEach(c => { const o = c.organized; const cur = orgToPkg.get(o)||{sum:0,count:0}; if(Number.isFinite(c.pkg)){ cur.sum+=c.pkg; cur.count++; } orgToPkg.set(o, cur); });
    const avgPackageByOrganizer = Array.from(orgToPkg.entries()).map(([organized, v])=>({ organized, avg: v.count ? Math.round(v.sum/v.count) : 0 }));

    return { perCompany, topCompanies, packageDist, organizedSplit, deptTotals, companyDept, deptSharePerCompany, cumulative, topDeptPerCompany, avgPackageByOrganizer };
  }, [rows, departments]);

  const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4', '#22c55e', '#eab308'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Career - Company Wise Analysis</h1>
          <p className="text-muted-foreground">Upload Excel/CSV and view company-wise insights</p>
        </div>
        <div className="flex items-center gap-2">
          <Input ref={fileRef} type="file" accept=".xlsx,.csv" onChange={onFileChange} />
          <Button variant="outline" onClick={()=>fileRef.current?.click()}>Upload</Button>
          <Button variant="outline" onClick={downloadTemplate}>Download Template</Button>
        </div>
      </div>

      {/* Raw data table for uploaded dataset */}
      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Uploaded Data ({rows.length} rows)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    {headers.map(h => (
                      <th key={h} className="p-2 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 300).map((r, idx) => (
                    <tr key={idx} className="border-t">
                      {headers.map(h => (
                        <td key={h} className="p-2 whitespace-nowrap">{String(r[h] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Showing first 300 rows for preview.</p>
          </CardContent>
        </Card>
      )}

      {rows.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Top Companies by Hires</CardTitle>
                <Button variant="outline" size="sm" onClick={() => {
                  const el = document.getElementById('chart-top-companies');
                  if (el) downloadNodeAsPng(el, 'top-companies');
                }}>Download PNG</Button>
              </div>
            </CardHeader>
            <CardContent id="chart-top-companies">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.topCompanies}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="company" interval={0} angle={-30} textAnchor="end" height={70} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="hires" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
              <p className="mt-2 text-xs text-muted-foreground text-center">Total hires per company</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Package Distribution</CardTitle>
                <Button variant="outline" size="sm" onClick={() => {
                  const el = document.getElementById('chart-package-dist');
                  if (el) downloadNodeAsPng(el, 'package-distribution');
                }}>Download PNG</Button>
              </div>
            </CardHeader>
            <CardContent id="chart-package-dist">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={metrics.packageDist}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
              <p className="mt-2 text-xs text-muted-foreground text-center">Count of companies by salary package range (LPA)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Organized By Split</CardTitle>
                <Button variant="outline" size="sm" onClick={() => {
                  const el = document.getElementById('chart-organized-split');
                  if (el) downloadNodeAsPng(el, 'organized-by-split');
                }}>Download PNG</Button>
              </div>
            </CardHeader>
            <CardContent id="chart-organized-split">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie dataKey="value" data={metrics.organizedSplit} cx="50%" cy="50%" outerRadius={80} label>
                    {metrics.organizedSplit.map((_, index) => (
                      <Cell key={`cell-org-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <p className="mt-2 text-xs text-muted-foreground text-center">Distribution of organizers</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Department Totals</CardTitle>
                <Button variant="outline" size="sm" onClick={() => {
                  const el = document.getElementById('chart-dept-totals');
                  if (el) downloadNodeAsPng(el, 'department-totals');
                }}>Download PNG</Button>
              </div>
            </CardHeader>
            <CardContent id="chart-dept-totals">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.deptTotals}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={70} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="hires" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
              <p className="mt-2 text-xs text-muted-foreground text-center">Total hires across departments</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Company vs Department (Top 10)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={metrics.companyDept}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="company" interval={0} angle={-30} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  {departments.map((d, idx) => (
                    <Bar key={d} dataKey={d} stackId="a" fill={COLORS[idx % COLORS.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
              <p className="mt-2 text-xs text-muted-foreground text-center">Stacked hires by department per company</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Department Share per Company (Top 10)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={metrics.deptSharePerCompany}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="company" interval={0} angle={-30} textAnchor="end" height={80} />
                  <YAxis domain={[0,100]} />
                  <Tooltip />
                  {departments.map((d, idx) => (
                    <Bar key={d} dataKey={d} stackId="a" fill={COLORS[idx % COLORS.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
              <p className="mt-2 text-xs text-muted-foreground text-center">Percent breakdown by department per company</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cumulative Hires (Descending by Hires)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={metrics.cumulative}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="idx" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="cumulative" stroke="#ef4444" />
                </LineChart>
              </ResponsiveContainer>
              <p className="mt-2 text-xs text-muted-foreground text-center">Cumulative hires across top companies</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Department per Company (Top 10)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.topDeptPerCompany}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="company" interval={0} angle={-30} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="hires" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
              <p className="mt-2 text-xs text-muted-foreground text-center">Highest contributing department for each company</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Average Package by Organizer</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={metrics.avgPackageByOrganizer}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="organized" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="avg" fill="#06b6d4" />
                </BarChart>
              </ResponsiveContainer>
              <p className="mt-2 text-xs text-muted-foreground text-center">Average package offered grouped by organizer</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Organizer Count</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={metrics.organizedSplit}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="organized" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
              <p className="mt-2 text-xs text-muted-foreground text-center">Number of companies by organizer</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default CareerCompanyAnalysis; 