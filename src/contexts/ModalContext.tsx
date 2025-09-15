import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ModalContextType {
  isCreateTaskModalOpen: boolean;
  openCreateTaskModal: () => void;
  closeCreateTaskModal: () => void;
  isCreateEventModalOpen: boolean;
  openCreateEventModal: () => void;
  closeCreateEventModal: () => void;
  isCreateTrainingModalOpen: boolean;
  openCreateTrainingModal: () => void;
  closeCreateTrainingModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false);
  const [isCreateTrainingModalOpen, setIsCreateTrainingModalOpen] = useState(false);

  const openCreateTaskModal = () => setIsCreateTaskModalOpen(true);
  const closeCreateTaskModal = () => setIsCreateTaskModalOpen(false);

  const openCreateEventModal = () => setIsCreateEventModalOpen(true);
  const closeCreateEventModal = () => setIsCreateEventModalOpen(false);

  const openCreateTrainingModal = () => setIsCreateTrainingModalOpen(true);
  const closeCreateTrainingModal = () => setIsCreateTrainingModalOpen(false);

  return (
    <ModalContext.Provider
      value={{
        isCreateTaskModalOpen,
        openCreateTaskModal,
        closeCreateTaskModal,
        isCreateEventModalOpen,
        openCreateEventModal,
        closeCreateEventModal,
        isCreateTrainingModalOpen,
        openCreateTrainingModal,
        closeCreateTrainingModal,
      }}
    >
      {children}
    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};
