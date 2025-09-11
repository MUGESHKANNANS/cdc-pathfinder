import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, User, Download, Plus, Search } from 'lucide-react';
import { format, isToday, isPast, isFuture } from 'date-fns';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

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
  const [events, setEvents] = useState<Event[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'past' | 'today' | 'upcoming'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

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
      setEvents(data || []);
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
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
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

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search events..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
              <SelectTrigger className="w-[200px]">
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
              <SelectTrigger className="w-[200px]">
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
        </CardContent>
      </Card>

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEvents.map((event) => {
          const status = getEventStatus(event.event_date);
          const isAssigned = !isDirector && isAssignedToEvent(event.id);
          
          return (
            <Card key={event.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{event.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {event.category && (
                        <Badge variant="secondary" className="text-xs">
                          {event.category}
                        </Badge>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge className={`text-xs ${getStatusColor(status)}`}>
                      {getStatusIcon(status)} {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Badge>
                    {isAssigned && (
                      <Badge variant="outline" className="text-xs border-primary text-primary">
                        Assigned
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 mr-2" />
                    {format(new Date(event.event_date), 'PPP')}
                  </div>
                  {event.event_time && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Clock className="h-4 w-4 mr-2" />
                      {event.event_time}
                    </div>
                  )}
                  {event.venue && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 mr-2" />
                      {event.venue}
                    </div>
                  )}
                  {event.organized_by && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <User className="h-4 w-4 mr-2" />
                      {event.organized_by}
                    </div>
                  )}
                  {event.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {event.description}
                    </p>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      View Details
                    </Button>
                    {event.attachment_url && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => downloadAttachment(event.attachment_url!, `${event.title}-attachment`)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
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
    </div>
  );
};

export default Events;