<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\RestaurantSetting;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    private ?string $adminPassword = null;

    public function run(): void
    {
        $this->createRoles();
        $this->createPermissions();
        $this->assignPermissionsToRoles();
        $this->createAdminUser();
        $this->createRestaurantSettings();
        $this->call(ProductionDataSeeder::class);
        $this->createAdminUser();
    }

    private function createRoles(): void
    {
        $roles = [
            ['name' => 'admin', 'display_name' => 'Administrator', 'description' => 'Full system access', 'is_system' => true],
            ['name' => 'manager', 'display_name' => 'Manager', 'description' => 'Restaurant manager with broad access', 'is_system' => true],
            ['name' => 'cashier', 'display_name' => 'Cashier', 'description' => 'POS and billing operations', 'is_system' => true],
            ['name' => 'waiter', 'display_name' => 'Waiter', 'description' => 'Order taking and table management', 'is_system' => true],
            ['name' => 'kitchen_staff', 'display_name' => 'Kitchen Staff', 'description' => 'Kitchen operations and KOT management', 'is_system' => true],
            ['name' => 'inventory_staff', 'display_name' => 'Inventory Staff', 'description' => 'Inventory and stock management', 'is_system' => true],
        ];

        foreach ($roles as $role) {
            Role::firstOrCreate(['name' => $role['name']], $role);
        }
    }

    private function createPermissions(): void
    {
        $permissions = [
            // Dashboard
            ['name' => 'view_dashboard', 'display_name' => 'View Dashboard', 'module' => 'dashboard', 'description' => 'Access dashboard overview'],
            ['name' => 'view_dashboard_reports', 'display_name' => 'View Dashboard Reports', 'module' => 'dashboard', 'description' => 'View dashboard report data'],

            // Customer Management
            ['name' => 'view_customers', 'display_name' => 'View Customers', 'module' => 'customers', 'description' => 'View customer list'],
            ['name' => 'create_customers', 'display_name' => 'Create Customers', 'module' => 'customers', 'description' => 'Create new customers'],
            ['name' => 'edit_customers', 'display_name' => 'Edit Customers', 'module' => 'customers', 'description' => 'Edit customer information'],
            ['name' => 'delete_customers', 'display_name' => 'Delete Customers', 'module' => 'customers', 'description' => 'Delete customers'],

            // Table Management
            ['name' => 'view_tables', 'display_name' => 'View Tables', 'module' => 'tables', 'description' => 'View table layout'],
            ['name' => 'manage_tables', 'display_name' => 'Manage Tables', 'module' => 'tables', 'description' => 'Create, edit, delete tables'],
            ['name' => 'manage_floor_plans', 'display_name' => 'Manage Floor Plans', 'module' => 'tables', 'description' => 'Create and edit floor plans'],

            // Reservations
            ['name' => 'view_reservations', 'display_name' => 'View Reservations', 'module' => 'reservations', 'description' => 'View reservations'],
            ['name' => 'create_reservations', 'display_name' => 'Create Reservations', 'module' => 'reservations', 'description' => 'Create new reservations'],
            ['name' => 'edit_reservations', 'display_name' => 'Edit Reservations', 'module' => 'reservations', 'description' => 'Edit reservations'],
            ['name' => 'delete_reservations', 'display_name' => 'Delete Reservations', 'module' => 'reservations', 'description' => 'Cancel/delete reservations'],
            ['name' => 'manage_waitlist', 'display_name' => 'Manage Waitlist', 'module' => 'reservations', 'description' => 'Manage customer waitlist'],

            // Menu Management
            ['name' => 'view_menu', 'display_name' => 'View Menu', 'module' => 'menu', 'description' => 'View menu items'],
            ['name' => 'create_menu', 'display_name' => 'Create Menu Items', 'module' => 'menu', 'description' => 'Create menu items and categories'],
            ['name' => 'edit_menu', 'display_name' => 'Edit Menu Items', 'module' => 'menu', 'description' => 'Edit menu items'],
            ['name' => 'delete_menu', 'display_name' => 'Delete Menu Items', 'module' => 'menu', 'description' => 'Delete menu items'],
            ['name' => 'manage_modifiers', 'display_name' => 'Manage Modifiers', 'module' => 'menu', 'description' => 'Manage menu item modifiers'],
            ['name' => 'manage_combos', 'display_name' => 'Manage Combos', 'module' => 'menu', 'description' => 'Manage combo meals'],

            // Order Management
            ['name' => 'view_orders', 'display_name' => 'View Orders', 'module' => 'orders', 'description' => 'View order list'],
            ['name' => 'create_orders', 'display_name' => 'Create Orders', 'module' => 'orders', 'description' => 'Create new orders'],
            ['name' => 'edit_orders', 'display_name' => 'Edit Orders', 'module' => 'orders', 'description' => 'Edit existing orders'],
            ['name' => 'cancel_orders', 'display_name' => 'Cancel Orders', 'module' => 'orders', 'description' => 'Cancel/void orders'],
            ['name' => 'manage_order_status', 'display_name' => 'Manage Order Status', 'module' => 'orders', 'description' => 'Update order status'],

            // KOT Management
            ['name' => 'view_kot', 'display_name' => 'View KOT', 'module' => 'kot', 'description' => 'View kitchen orders'],
            ['name' => 'update_kot_status', 'display_name' => 'Update KOT Status', 'module' => 'kot', 'description' => 'Update kitchen order status'],
            ['name' => 'print_kot', 'display_name' => 'Print KOT', 'module' => 'kot', 'description' => 'Print kitchen order tickets'],

            // POS / Billing
            ['name' => 'view_invoices', 'display_name' => 'View Invoices', 'module' => 'pos', 'description' => 'View invoices'],
            ['name' => 'create_invoices', 'display_name' => 'Create Invoices', 'module' => 'pos', 'description' => 'Create invoices'],
            ['name' => 'process_payments', 'display_name' => 'Process Payments', 'module' => 'pos', 'description' => 'Process payment transactions'],
            ['name' => 'manage_discounts', 'display_name' => 'Manage Discounts', 'module' => 'pos', 'description' => 'Create and manage discounts'],
            ['name' => 'manage_gift_cards', 'display_name' => 'Manage Gift Cards', 'module' => 'pos', 'description' => 'Manage gift cards'],
            ['name' => 'manage_cash_register', 'display_name' => 'Manage Cash Register', 'module' => 'pos', 'description' => 'Open/close cash register, cash drawer operations'],

            // Inventory
            ['name' => 'view_inventory', 'display_name' => 'View Inventory', 'module' => 'inventory', 'description' => 'View inventory items'],
            ['name' => 'create_inventory', 'display_name' => 'Create Inventory Items', 'module' => 'inventory', 'description' => 'Add ingredients and stock items'],
            ['name' => 'edit_inventory', 'display_name' => 'Edit Inventory', 'module' => 'inventory', 'description' => 'Edit inventory items'],
            ['name' => 'delete_inventory', 'display_name' => 'Delete Inventory', 'module' => 'inventory', 'description' => 'Delete inventory items'],
            ['name' => 'manage_stock_movements', 'display_name' => 'Manage Stock Movements', 'module' => 'inventory', 'description' => 'Record stock in/out/wastage'],
            ['name' => 'manage_purchase_orders', 'display_name' => 'Manage Purchase Orders', 'module' => 'inventory', 'description' => 'Create and manage purchase orders'],
            ['name' => 'manage_suppliers', 'display_name' => 'Manage Suppliers', 'module' => 'inventory', 'description' => 'Manage supplier information'],
            ['name' => 'manage_recipes', 'display_name' => 'Manage Recipes', 'module' => 'inventory', 'description' => 'Manage recipe/ingredient mappings'],

            // Staff
            ['name' => 'view_staff', 'display_name' => 'View Staff', 'module' => 'staff', 'description' => 'View staff list'],
            ['name' => 'create_staff', 'display_name' => 'Create Staff', 'module' => 'staff', 'description' => 'Add new staff members'],
            ['name' => 'edit_staff', 'display_name' => 'Edit Staff', 'module' => 'staff', 'description' => 'Edit staff information'],
            ['name' => 'delete_staff', 'display_name' => 'Delete Staff', 'module' => 'staff', 'description' => 'Delete staff members'],
            ['name' => 'manage_staff_schedule', 'display_name' => 'Manage Staff Schedule', 'module' => 'staff', 'description' => 'Manage staff scheduling'],
            ['name' => 'view_staff_performance', 'display_name' => 'View Staff Performance', 'module' => 'staff', 'description' => 'View staff performance reports'],
            ['name' => 'manage_staff_leave', 'display_name' => 'Manage Staff Leave', 'module' => 'staff', 'description' => 'Manage staff leave requests'],

            // Reports
            ['name' => 'view_reports', 'display_name' => 'View Reports', 'module' => 'reports', 'description' => 'Access reports section'],
            ['name' => 'export_reports', 'display_name' => 'Export Reports', 'module' => 'reports', 'description' => 'Export report data'],

            // Admin
            ['name' => 'manage_users', 'display_name' => 'Manage Users', 'module' => 'admin', 'description' => 'Create, edit, delete users'],
            ['name' => 'manage_roles', 'display_name' => 'Manage Roles', 'module' => 'admin', 'description' => 'Create, edit, delete roles'],
            ['name' => 'manage_settings', 'display_name' => 'Manage Settings', 'module' => 'admin', 'description' => 'Manage restaurant settings'],
            ['name' => 'manage_outlets', 'display_name' => 'Manage Outlets', 'module' => 'admin', 'description' => 'Manage restaurant outlets'],
            ['name' => 'view_audit_logs', 'display_name' => 'View Audit Logs', 'module' => 'admin', 'description' => 'View system audit logs'],

            // Integration
            ['name' => 'manage_integrations', 'display_name' => 'Manage Integrations', 'module' => 'integration', 'description' => 'Manage webhooks and integrations'],
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission['name']], $permission);
        }
    }

    private function assignPermissionsToRoles(): void
    {
        $admin = Role::where('name', 'admin')->first();
        $manager = Role::where('name', 'manager')->first();
        $cashier = Role::where('name', 'cashier')->first();
        $waiter = Role::where('name', 'waiter')->first();
        $kitchenStaff = Role::where('name', 'kitchen_staff')->first();
        $inventoryStaff = Role::where('name', 'inventory_staff')->first();

        // Admin gets everything
        $admin->permissions()->syncWithoutDetaching(Permission::pluck('id'));

        // Manager gets most permissions except user/role management
        $manager->permissions()->syncWithoutDetaching(
            Permission::whereNotIn('name', ['manage_users', 'manage_roles', 'manage_outlets', 'view_audit_logs'])->pluck('id')
        );

        // Cashier: POS, orders, customers, menu view, dashboard
        $cashier->permissions()->syncWithoutDetaching(
            Permission::whereIn('name', [
                'view_dashboard',
                'view_customers', 'create_customers', 'edit_customers',
                'view_tables',
                'view_menu',
                'view_orders', 'create_orders', 'edit_orders', 'manage_order_status',
                'view_invoices', 'create_invoices', 'process_payments',
                'manage_discounts', 'manage_gift_cards', 'manage_cash_register',
                'view_reservations', 'create_reservations',
            ])->pluck('id')
        );

        // Waiter: orders, tables, reservations, menu view, KOT view, customers
        $waiter->permissions()->syncWithoutDetaching(
            Permission::whereIn('name', [
                'view_dashboard',
                'view_customers', 'create_customers',
                'view_tables', 'manage_tables',
                'view_menu',
                'view_orders', 'create_orders', 'edit_orders', 'manage_order_status',
                'view_kot', 'print_kot',
                'view_reservations', 'create_reservations', 'edit_reservations', 'manage_waitlist',
                'view_invoices',
            ])->pluck('id')
        );

        // Kitchen staff: KOT, menu view
        $kitchenStaff->permissions()->syncWithoutDetaching(
            Permission::whereIn('name', [
                'view_dashboard',
                'view_menu',
                'view_kot', 'update_kot_status', 'print_kot',
                'view_orders',
            ])->pluck('id')
        );

        // Inventory staff: inventory, stock movements, purchase orders, suppliers, recipes
        $inventoryStaff->permissions()->syncWithoutDetaching(
            Permission::whereIn('name', [
                'view_dashboard',
                'view_inventory', 'create_inventory', 'edit_inventory',
                'manage_stock_movements',
                'manage_purchase_orders',
                'manage_suppliers',
                'manage_recipes',
            ])->pluck('id')
        );
    }

    private function adminSeedPassword(): string
    {
        if ($this->adminPassword !== null) {
            return $this->adminPassword;
        }

        $password = env('ADMIN_PASSWORD');
        if (!$password) {
            $password = Str::random(24);
            $this->command?->warn('No ADMIN_PASSWORD env set. Generated admin password: '.$password);
        }

        return $this->adminPassword = $password;
    }

    private function createAdminUser(): void
    {
        $admin = User::firstOrCreate(
            ['email' => 'admin@rms.com'],
            [
                'id' => Str::uuid()->toString(),
                'name' => 'Admin',
                'password' => Hash::make($this->adminSeedPassword()),
                'is_active' => true,
                'email_verified_at' => now(),
            ]
        );

        if (!$admin->roles()->where('role_id', Role::where('name', 'admin')->first()->id)->exists()) {
            $admin->roles()->attach(Role::where('name', 'admin')->first());
        }
    }

    private function createRestaurantSettings(): void
    {
        if (RestaurantSetting::count() > 0) return;
        RestaurantSetting::create([
            'name' => 'Demo Restaurant',
            'description' => 'A demo restaurant for the Restaurant Management System',
            'address' => '123 Main Street',
            'city' => 'Manila',
            'state' => 'Metro Manila',
            'postal_code' => '1000',
            'country' => 'Philippines',
            'phone' => '+63 917 123 4567',
            'email' => 'info@demorestaurant.com',
            'website' => 'https://demorestaurant.com',
            'timezone' => 'Asia/Manila',
            'currency' => 'PHP',
            'currency_symbol' => '₱',
            'tax_id' => '123-456-789-000',
            'default_tax_rate' => 12.00,
            'vat_enabled' => true,
            'vat_inclusive' => true,
            'default_service_charge' => 0.00,
            'service_charge_enabled' => false,
            'receipt_header' => 'DEMO RESTAURANT',
            'receipt_footer' => 'Thank you for dining with us!',
            'order_prefix' => 'ORD-',
            'invoice_prefix' => 'INV-',
            'table_reservation_timeout' => 15,
            'kitchen_display_timeout' => 30,
            'auto_cancel_timeout' => 30,
            'allow_negative_inventory' => false,
            'low_stock_threshold' => 10,
            // Reservation policy settings
            'reservation_card_threshold' => 6,
            'reservation_no_show_fee' => 15.00,
            'reservation_no_show_flag_threshold' => 2,
            'reservation_deposit_percentage' => 50.00,
            'reservation_cancellation_window_minutes' => 15,
            'reservation_regular_duration_minutes' => 180,
            'reservation_large_duration_minutes' => 240,
            'reservation_weekend_days' => [5, 6], // Friday=5, Saturday=6
            'opening_hours' => [
                'monday' => ['open' => '08:00', 'close' => '22:00'],
                'tuesday' => ['open' => '08:00', 'close' => '22:00'],
                'wednesday' => ['open' => '08:00', 'close' => '22:00'],
                'thursday' => ['open' => '08:00', 'close' => '22:00'],
                'friday' => ['open' => '08:00', 'close' => '23:00'],
                'saturday' => ['open' => '08:00', 'close' => '23:00'],
                'sunday' => ['open' => '09:00', 'close' => '21:00'],
            ],
        ]);
    }
}
