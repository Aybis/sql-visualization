-- SQL Server (T-SQL) Enterprise HR Schema
CREATE TABLE [dbo].[Locations] (
    [LocationId] INT IDENTITY(1,1) NOT NULL,
    [City] NVARCHAR(100) NOT NULL,
    [Country] NVARCHAR(80) NOT NULL,
    [Timezone] NVARCHAR(50) NOT NULL,
    CONSTRAINT [PK_Locations] PRIMARY KEY CLUSTERED ([LocationId])
);
GO

CREATE TABLE [dbo].[Departments] (
    [DepartmentId] INT IDENTITY(1,1) NOT NULL,
    [LocationId] INT NOT NULL,
    [Name] NVARCHAR(120) NOT NULL,
    [CostCenter] NVARCHAR(32) NOT NULL UNIQUE,
    CONSTRAINT [PK_Departments] PRIMARY KEY CLUSTERED ([DepartmentId])
);
GO

CREATE TABLE [dbo].[JobTitles] (
    [JobTitleId] INT IDENTITY(1,1) NOT NULL,
    [Title] NVARCHAR(120) NOT NULL,
    [MinSalary] DECIMAL(12,2) NOT NULL,
    [MaxSalary] DECIMAL(12,2) NOT NULL,
    CONSTRAINT [PK_JobTitles] PRIMARY KEY CLUSTERED ([JobTitleId])
);
GO

CREATE TABLE [dbo].[Employees] (
    [EmployeeId] INT IDENTITY(1,1) NOT NULL,
    [DepartmentId] INT NOT NULL,
    [JobTitleId] INT NOT NULL,
    [ManagerId] INT NULL,
    [Email] NVARCHAR(200) NOT NULL UNIQUE,
    [FirstName] NVARCHAR(80) NOT NULL,
    [LastName] NVARCHAR(80) NOT NULL,
    [HireDate] DATE NOT NULL,
    [Salary] DECIMAL(12,2) NOT NULL,
    CONSTRAINT [PK_Employees] PRIMARY KEY CLUSTERED ([EmployeeId])
);
GO

CREATE TABLE [dbo].[Payrolls] (
    [PayrollId] BIGINT IDENTITY(1,1) NOT NULL,
    [EmployeeId] INT NOT NULL,
    [PayPeriodStart] DATE NOT NULL,
    [PayPeriodEnd] DATE NOT NULL,
    [GrossPay] DECIMAL(12,2) NOT NULL,
    [NetPay] DECIMAL(12,2) NOT NULL,
    CONSTRAINT [PK_Payrolls] PRIMARY KEY CLUSTERED ([PayrollId])
);
GO

CREATE TABLE [dbo].[LeaveRequests] (
    [LeaveRequestId] BIGINT IDENTITY(1,1) NOT NULL,
    [EmployeeId] INT NOT NULL,
    [ApproverId] INT NULL,
    [StartDate] DATE NOT NULL,
    [EndDate] DATE NOT NULL,
    [Status] NVARCHAR(24) NOT NULL DEFAULT N'Pending',
    CONSTRAINT [PK_LeaveRequests] PRIMARY KEY CLUSTERED ([LeaveRequestId])
);
GO

ALTER TABLE [dbo].[Departments] WITH CHECK ADD CONSTRAINT [FK_Departments_Locations]
    FOREIGN KEY([LocationId]) REFERENCES [dbo].[Locations]([LocationId]);
GO

ALTER TABLE [dbo].[Employees] WITH CHECK ADD CONSTRAINT [FK_Employees_Departments]
    FOREIGN KEY([DepartmentId]) REFERENCES [dbo].[Departments]([DepartmentId]);
GO

ALTER TABLE [dbo].[Employees] WITH CHECK ADD CONSTRAINT [FK_Employees_JobTitles]
    FOREIGN KEY([JobTitleId]) REFERENCES [dbo].[JobTitles]([JobTitleId]);
GO

ALTER TABLE [dbo].[Employees] WITH CHECK ADD CONSTRAINT [FK_Employees_Manager]
    FOREIGN KEY([ManagerId]) REFERENCES [dbo].[Employees]([EmployeeId]);
GO

ALTER TABLE [dbo].[Payrolls] WITH CHECK ADD CONSTRAINT [FK_Payrolls_Employees]
    FOREIGN KEY([EmployeeId]) REFERENCES [dbo].[Employees]([EmployeeId]) ON DELETE CASCADE;
GO

ALTER TABLE [dbo].[LeaveRequests] WITH CHECK ADD CONSTRAINT [FK_LeaveRequests_Employee]
    FOREIGN KEY([EmployeeId]) REFERENCES [dbo].[Employees]([EmployeeId]) ON DELETE CASCADE;
GO

ALTER TABLE [dbo].[LeaveRequests] WITH CHECK ADD CONSTRAINT [FK_LeaveRequests_Approver]
    FOREIGN KEY([ApproverId]) REFERENCES [dbo].[Employees]([EmployeeId]);
GO
