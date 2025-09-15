import React from 'react';

const ComingSoon: React.FC<{ title: string; description?: string }> = ({ title, description }) => {
  return (
    <div className="p-12 text-center">
      <h1 className="text-3xl font-bold mb-2">{title}</h1>
      <p className="text-muted-foreground mb-8">{description || 'This module is coming soon.'}</p>
      <div className="inline-flex items-center justify-center rounded-xl border px-6 py-3 text-sm text-muted-foreground">
        Coming soon
      </div>
    </div>
  );
};

export default ComingSoon; 