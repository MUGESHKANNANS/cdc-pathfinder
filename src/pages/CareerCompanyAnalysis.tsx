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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter } from 'lucide-react';

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
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [organizerFilter, setOrganizerFilter] = useState<string>('all');

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

  const companies = useMemo(() => Array.from(new Set(rows.map(r => String(r['Company Name'] || 'NA')))), [rows]);
  const organizers = useMemo(() => Array.from(new Set(rows.map(r => String(r['Organized'] || 'NA')))), [rows]);

  const filteredRows = useMemo(() => {
    const s = search.toLowerCase();
    return rows.filter(r => {
      const matchesSearch = s ? String(r['Company Name']||'').toLowerCase().includes(s) : true;
      const matchesCompany = companyFilter === 'all' ? true : String(r['Company Name']||'') === companyFilter;
      const matchesOrganizer = organizerFilter === 'all' ? true : String(r['Organized']||'') === organizerFilter;
      return matchesSearch && matchesCompany && matchesOrganizer;
    });
  }, [rows, search, companyFilter, organizerFilter]);

  const metrics = useMemo(() => {
    // Company totals by department and overall
    const perCompany = filteredRows.map(r => {
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

    // Company-wise average package (bar)
    const avgPackageByCompany = perCompany.map(c => ({ company: c.company, avg: c.pkg }));

    // Company-wise total placed (pie)
    const companyTotalsPie = perCompany.slice(0, 12).map(c => ({ name: c.company, value: c.total }));

    // Dept-wise top 3 hiring companies
    const deptTop3 = departments.slice(0, 8).map(d => {
      const list = perCompany.map(c => ({ company: c.company, hires: c.depts[d] || 0 })).sort((a,b)=>b.hires-a.hires).slice(0,3);
      return { dept: d, c1: list[0]?.hires||0, c2: list[1]?.hires||0, c3: list[2]?.hires||0, n1: list[0]?.company||'', n2: list[1]?.company||'', n3: list[2]?.company||'' };
    });

    // Heatmap table data (company vs dept)
    const heatmap = perCompany.slice(0, 12).map(c => ({ company: c.company, ...c.depts }));

    // Top 5 companies by package
    const top5ByPackage = [...perCompany].sort((a,b)=>b.pkg-a.pkg).slice(0,5).map(x=>({ company: x.company, pkg: x.pkg }));

    // Organizer drive count per company (occurrence count)
    const companyDriveCountMap = new Map<string, number>();
    filteredRows.forEach(r => { const c = String(r['Company Name']||'NA'); companyDriveCountMap.set(c, (companyDriveCountMap.get(c)||0)+1); });
    const companyDriveCount = Array.from(companyDriveCountMap.entries()).map(([company, count])=>({ company, count }));

    // Overall placement contribution by company (donut)
    const contribution = companyTotalsPie;

    // Multi-year trend if Batch or Year exists
    const hasBatch = headers.includes('Batch') || headers.includes('Year');
    const batchKey = headers.includes('Batch') ? 'Batch' : (headers.includes('Year') ? 'Year' : '');
    const companyBatchTrend = hasBatch ? (() => {
      const mb = new Map<string, Map<string, number>>();
      filteredRows.forEach(r => { const c = String(r['Company Name']||'NA'); const b = String(r[batchKey]||'NA'); const val = Number(r['Total'])||0; const m = mb.get(c)||new Map(); m.set(b, (m.get(b)||0)+val); mb.set(c, m); });
      const top = [...perCompany].sort((a,b)=>b.total-a.total).slice(0,5).map(c=>c.company);
      const batches = Array.from(new Set(filteredRows.map(r=>String(r[batchKey]||'NA'))));
      return top.map(company => ({ company, ...Object.fromEntries(batches.map(b=>[b, mb.get(company)?.get(b)||0])) }));
    })() : [];

    // Dept-wise highest package company (table rows)
    const deptHighestPackage = departments.map(d => {
      const eligible = perCompany.filter(c => (c.depts[d]||0) > 0);
      const best = eligible.sort((a,b)=>b.pkg-a.pkg)[0];
      return { dept: d, company: best?.company || 'NA', pkg: best?.pkg || 0 };
    });

    // Bubble: company vs package range (x: pkg, y: total, z: depts>0)
    const bubbleData = perCompany.map(c => ({ x: c.pkg, y: c.total, z: Object.values(c.depts).filter((v:any)=>Number(v)>0).length, company: c.company }));

    // Top 10 combined: stacked depts + line for package
    const top10 = [...perCompany].sort((a,b)=>b.total-a.total).slice(0,10);
    const top10Combined = top10.map(c => ({ company: c.company, pkg: c.pkg, ...c.depts }));

    return { perCompany, topCompanies, packageDist, organizedSplit, deptTotals, companyDept, deptSharePerCompany, cumulative, topDeptPerCompany, avgPackageByOrganizer,
      avgPackageByCompany, companyTotalsPie, deptTop3, heatmap, top5ByPackage, companyDriveCount, contribution, companyBatchTrend, deptHighestPackage, bubbleData, top10Combined };
  }, [filteredRows, departments, headers]);

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

      {/* Controls + Raw data */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground text-left">Search Company</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="e.g., TCS" className="pl-10 h-10 border border-indigo-300" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground text-left">Company</label>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="h-10 border border-indigo-300">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {companies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground text-left">Organizer</label>
            <Select value={organizerFilter} onValueChange={setOrganizerFilter}>
              <SelectTrigger className="h-10 border border-indigo-300">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {organizers.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Raw data table for uploaded dataset */}
      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Uploaded Data ({filteredRows.length} rows)</CardTitle>
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
                  {filteredRows.slice(0, 300).map((r, idx) => (
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
              <CardTitle>Average Package by Company</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={metrics.avgPackageByCompany.slice(0, 20)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="company" interval={0} angle={-30} textAnchor="end" height={70} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="avg" fill="#06b6d4" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Company-wise Total Students Placed</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie dataKey="value" data={metrics.companyTotalsPie} cx="50%" cy="50%" outerRadius={100} label>
                    {metrics.companyTotalsPie.map((_,i)=>(<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dept-wise Top 3 Hiring Companies</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={metrics.deptTop3}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={70} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="c1" fill="#3b82f6" />
                  <Bar dataKey="c2" fill="#ef4444" />
                  <Bar dataKey="c3" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
              <p className="mt-2 text-xs text-muted-foreground text-center">Hover to view counts; top three per dept</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Company vs Department Heatmap</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="p-2">Company</th>
                      {departments.map(d => (<th key={d} className="p-2">{d}</th>))}
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.heatmap.map((row:any, idx:number) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2 whitespace-nowrap">{row.company}</td>
                        {departments.map(d => {
                          const v = Number(row[d]||0);
                          const hue = v === 0 ? 0 : 220; // simple color scale
                          const light = 100 - Math.min(90, v*5);
                          return <td key={d} className="p-1"><span className="inline-block w-16 h-4" style={{ backgroundColor: `hsl(${hue},70%,${light}%)` }} /></td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top 5 Companies by Package</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={metrics.top5ByPackage} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="company" width={140} />
                  <Tooltip />
                  <Bar dataKey="pkg" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Company-wise Organized Drives Count</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={metrics.companyDriveCount}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="company" interval={0} angle={-30} textAnchor="end" height={70} />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#22c55e" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Overall Placement Contribution by Company</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie dataKey="value" data={metrics.contribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} label>
                    {metrics.contribution.map((_,i)=>(<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {metrics.companyBatchTrend.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Multi-Year Trend: Company Placements Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metrics.companyBatchTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="company" interval={0} angle={-30} textAnchor="end" height={70} />
                    <YAxis />
                    <Tooltip />
                    {/* Dynamic lines for batches/years */}
                    {Object.keys(metrics.companyBatchTrend[0]||{}).filter(k=>k!=='company').map((k,idx)=>(
                      <Line key={k} type="monotone" dataKey={k} stroke={COLORS[idx % COLORS.length]} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Dept-wise Highest Package Company</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="p-2">Dept</th>
                      <th className="p-2">Company</th>
                      <th className="p-2">Package</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.deptHighestPackage.map((r:any, idx:number)=>(
                      <tr key={idx} className="border-t">
                        <td className="p-2">{r.dept}</td>
                        <td className="p-2">{r.company}</td>
                        <td className="p-2">{r.pkg}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Placement Share vs Package (Bubble)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={metrics.bubbleData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="x" name="Package" />
                  <YAxis dataKey="y" name="Total" />
                  <Tooltip />
                  <Bar dataKey="y" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top 10 Companies – Combined View</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={metrics.top10Combined}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="company" interval={0} angle={-30} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  {departments.map((d, idx) => (
                    <Bar key={d} dataKey={d} stackId="a" fill={COLORS[idx % COLORS.length]} />
                  ))}
                  <Line type="monotone" dataKey="pkg" stroke="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
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