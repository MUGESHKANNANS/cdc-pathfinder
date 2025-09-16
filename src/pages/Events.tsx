import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, User, Download, Plus, Search } from 'lucide-react';
import { Filter as FilterIcon } from 'lucide-react';
import { format, isToday, isPast, isFuture } from 'date-fns';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface Event {
  id: string;
  title: string;
  description: string | null;
  organized_by: string | null;
  event_date: string;
  event_time: string | null;
  venue: string | null;
  category: string | null;
  attachment_url: string | null;
  created_by: string | null;
  created_at: string;
}

interface Assignment {
  id: string;
  event_id: string;
  faculty_id: string;
  assigned_at: string;
}

const Events = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<(Event & { signed_image_url?: string | null; is_image?: boolean })[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'past' | 'today' | 'upcoming'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<(Event & { signed_image_url?: string | null; is_image?: boolean }) | null>(null);

  const isDirector = profile?.role === 'cdc_director';

  useEffect(() => {
    fetchEvents();
    if (!isDirector) {
      fetchAssignments();
    }
  }, [isDirector]);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: false });

      if (error) throw error;
      const eventsWithSignedUrls = await Promise.all((data || []).map(async (evt) => {
        const path = evt.attachment_url || '';
        const isImage = /\.(png|jpg|jpeg)$/i.test(path);
        if (path && isImage) {
          try {
            const { data: signed, error: signedErr } = await supabase
              .storage
              .from('event-attachments')
              .createSignedUrl(path, 60 * 60); // 1 hour
            if (signedErr) throw signedErr;
            return { ...evt, signed_image_url: signed?.signedUrl || null, is_image: true };
          } catch {
            return { ...evt, signed_image_url: null, is_image: true };
          }
        }
        return { ...evt, signed_image_url: null, is_image: false };
      }));
      setEvents(eventsWithSignedUrls);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast({
        title: "Error",
        description: "Failed to fetch events. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async () => {
    if (!profile?.user_id) return;
    
    try {
      const { data, error } = await supabase
        .from('event_assignments')
        .select('*')
        .eq('faculty_id', profile.user_id);

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    }
  };

  const getEventStatus = (eventDate: string) => {
    const date = new Date(eventDate);
    if (isPast(date) && !isToday(date)) return 'past';
    if (isToday(date)) return 'today';
    return 'upcoming';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'past': return 'bg-gray-100 text-gray-800';
      case 'today': return 'bg-green-100 text-green-800';
      case 'upcoming': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'past': return '⚪';
      case 'today': return '🟢';
      case 'upcoming': return '🔵';
      default: return '⚪';
    }
  };

  const isAssignedToEvent = (eventId: string) => {
    return assignments.some(assignment => assignment.event_id === eventId);
  };

  const filteredEvents = events.filter(event => {
    const status = getEventStatus(event.event_date);
    const matchesFilter = filter === 'all' || status === filter;
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.organized_by?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.category?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || event.category === categoryFilter;
    
    // For faculty, show all events or only assigned ones based on view
    if (!isDirector) {
      return matchesFilter && matchesSearch && matchesCategory;
    }
    
    return matchesFilter && matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(events.map(e => e.category).filter(Boolean)));

  const downloadAttachment = async (attachmentUrl: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('event-attachments')
        .download(attachmentUrl);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const dotIndex = attachmentUrl.lastIndexOf('.');
      const ext = dotIndex !== -1 ? attachmentUrl.slice(dotIndex + 1) : '';
      const safeBase = fileName.replace(/[^a-z0-9\-\_\s]/gi, '_');
      const finalName = ext ? `${safeBase}.${ext}` : safeBase;
      const a = document.createElement('a');
      a.href = url;
      a.download = finalName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "Error",
        description: "Failed to download attachment.",
        variant: "destructive"
      });
    }
  };

  const downloadEventPdfAndAttachment = async (
    evt: Event & { signed_image_url?: string | null; is_image?: boolean }
  ) => {
    try {
      const [{ jsPDF }, JSZip] = await Promise.all([
        import('jspdf'),
        import('jszip')
      ]);
      const doc = new jsPDF();

      const left = 14;
      let y = 20;
      const lineGap = 8;

      doc.setFontSize(16);
      doc.text('Event Details', left, y);
      y += lineGap + 2;
      doc.setFontSize(12);
      doc.text(`Title: ${evt.title}`, left, y); y += lineGap;
      if (evt.organized_by) { doc.text(`Organizer: ${evt.organized_by}`, left, y); y += lineGap; }
      doc.text(`Date: ${format(new Date(evt.event_date), 'PPP')}`, left, y); y += lineGap;
      if (evt.event_time) { doc.text(`Time: ${evt.event_time}`, left, y); y += lineGap; }
      if (evt.venue) { doc.text(`Venue: ${evt.venue}`, left, y); y += lineGap; }
      if (evt.category) { doc.text(`Category: ${evt.category}`, left, y); y += lineGap; }

      if (evt.description) {
        const split = doc.splitTextToSize(`Description: ${evt.description}`, 180);
        doc.text(split, left, y);
      }

      const pdfBlob = doc.output('blob');

      const zip = new JSZip.default();
      const safeTitle = evt.title.replace(/[^a-z0-9\-\_\s]/gi, '_');
      zip.file(`${safeTitle}-event.pdf`, pdfBlob);

      if (evt.attachment_url) {
        const { data, error } = await supabase.storage
          .from('event-attachments')
          .download(evt.attachment_url);
        if (error) throw error;
        const dotIndex = evt.attachment_url.lastIndexOf('.');
        const ext = dotIndex !== -1 ? evt.attachment_url.slice(dotIndex + 1) : '';
        const attachName = ext ? `${safeTitle}-attachment.${ext}` : `${safeTitle}-attachment`;
        zip.file(attachName, data);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeTitle}-event.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating ZIP with PDF/attachment:', error);
      toast({
        title: 'Error',
        description: 'Failed to download event ZIP.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Events</h1>
          <p className="text-muted-foreground">
            {isDirector ? 'Manage and view all events' : 'View events and your assignments'}
          </p>
        </div>
        {isDirector && (
          <Link to="/events/create">
            <Button className="bg-primary hover:bg-primary-hover text-primary-foreground">
              <Plus className="h-4 w-4 mr-2" />
              Create Event
            </Button>
          </Link>
        )}
      </div>

      {/* Filters (inline, no background) */}
      <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-12 rounded-xl border border-indigo-300"
          />
        </div>
        <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
          <SelectTrigger className="w-[220px] h-12 rounded-xl border border-indigo-300">
            <FilterIcon className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            <SelectItem value="upcoming">🔵 Upcoming</SelectItem>
            <SelectItem value="today">🟢 Today</SelectItem>
            <SelectItem value="past">⚪ Past</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[220px] h-12 rounded-xl border border-indigo-300">
            <FilterIcon className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(category => (
              <SelectItem key={category} value={category!}>{category}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEvents.map((event) => {
          const status = getEventStatus(event.event_date);
          const isAssigned = !isDirector && isAssignedToEvent(event.id);
          const bannerUrl = event.is_image && event.signed_image_url ? event.signed_image_url : '/placeholder.svg';
          
          return (
            <Card
              key={event.id}
              className="group overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm transition-all duration-300 hover:shadow-xl hover:border-border"
            >
              <div className="relative h-40 w-full overflow-hidden">
                <img
                  src={bannerUrl}
                  alt={event.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {event.category && (
                      <Badge variant="secondary" className="bg-white/90 text-foreground backdrop-blur px-2 py-0.5 text-[11px]">
                        {event.category}
                      </Badge>
                    )}
                    {isAssigned && (
                      <Badge variant="outline" className="border-white/70 text-white px-2 py-0.5 text-[11px]">
                        Assigned
                      </Badge>
                    )}
                  </div>
                  <Badge className={`px-2 py-0.5 text-[11px] ${getStatusColor(status)} bg-white/90 backdrop-blur`}>
                    {getStatusIcon(status)} {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Badge>
                </div>
                <div className="absolute inset-x-4 bottom-3">
                  <h3 className="text-white font-semibold text-lg drop-shadow-sm">
                    {event.title}
                  </h3>
                  {event.organized_by && (
                    <p className="text-white/90 text-xs mt-0.5">by {event.organized_by}</p>
                  )}
                </div>
              </div>

              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-foreground/70" />
                      {format(new Date(event.event_date), 'PPP')}
                    </div>
                    {event.event_time && (
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-foreground/70" />
                        {event.event_time}
                      </div>
                    )}
                    {event.venue && (
                      <div className="flex items-center sm:col-span-2">
                        <MapPin className="h-4 w-4 mr-2 text-foreground/70" />
                        {event.venue}
                      </div>
                    )}
                  </div>

                  {event.description && (
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {event.description}
                    </p>
                  )}

                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => { setSelectedEvent(event); setDetailsOpen(true); }}
                    >
                      View Details
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => downloadEventPdfAndAttachment(event)}
                      title="Download event PDF and attachment"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredEvents.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No events found</h3>
            <p className="text-muted-foreground text-center">
              {searchTerm || categoryFilter !== 'all' || filter !== 'all'
                ? 'Try adjusting your filters or search term.'
                : isDirector 
                  ? 'Start by creating your first event.'
                  : 'No events have been created yet.'
              }
            </p>
            {isDirector && !searchTerm && categoryFilter === 'all' && filter === 'all' && (
              <Link to="/events/create" className="mt-4">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Event
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          {selectedEvent && (
            <div className="w-full">
              <div className="relative h-48 w-full overflow-hidden">
                <img
                  src={selectedEvent.is_image && selectedEvent.signed_image_url ? selectedEvent.signed_image_url : '/placeholder.svg'}
                  alt={selectedEvent.title}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-white text-xl font-semibold">{selectedEvent.title}</h2>
                      {selectedEvent.organized_by && (
                        <p className="text-white/90 text-xs">by {selectedEvent.organized_by}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedEvent.category && (
                        <Badge variant="secondary" className="bg-white/90 text-foreground backdrop-blur px-2 py-0.5 text-[11px]">
                          {selectedEvent.category}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-muted-foreground">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2 text-foreground/70" />
                    {format(new Date(selectedEvent.event_date), 'PPP')}
                  </div>
                  {selectedEvent.event_time && (
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-2 text-foreground/70" />
                      {selectedEvent.event_time}
                    </div>
                  )}
                  {selectedEvent.venue && (
                    <div className="flex items-center sm:col-span-2">
                      <MapPin className="h-4 w-4 mr-2 text-foreground/70" />
                      {selectedEvent.venue}
                    </div>
                  )}
                </div>
                {selectedEvent.description && (
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-1">Description</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">{selectedEvent.description}</p>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  {selectedEvent.attachment_url && (
                    <Button
                      variant="outline"
                      onClick={() => downloadAttachment(selectedEvent.attachment_url!, `${selectedEvent.title}-attachment`)}
                    >
                      <Download className="h-4 w-4 mr-2" /> Download
                    </Button>
                  )}
                  <Button onClick={() => setDetailsOpen(false)}>Close</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Events;