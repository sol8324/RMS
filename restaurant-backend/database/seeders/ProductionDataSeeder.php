<?php

namespace Database\Seeders;

use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class ProductionDataSeeder extends Seeder
{
    private array $ids = [];
    private Carbon $now;
    private Carbon $sevenYearsAgo;
    private ?string $userPassword = null;

    public function run(): void
    {
        $this->now = Carbon::now();
        $this->sevenYearsAgo = (new Carbon($this->now))->subYears(7);

        $this->setForeignKeyChecks(false);

        $this->truncateRelevantTables();
        $this->createOutlets();
        $this->createUsers();
        $this->createCustomers();
        $this->createMenuCategories();
        $this->createMenuItems();
        $this->createSuppliers();
        $this->createIngredients();
        $this->createRecipes();
        $this->createTables();
        $this->createDiscounts();
        $this->createReservations();
        $this->createOrders();
        $this->createKitchenTickets();
        $this->createStaffShifts();
        $this->createStaffSchedules();
        $this->createPurchaseOrders();
        $this->createStockMovements();
        $this->createAuditLogs();

        $this->setForeignKeyChecks(true);
    }

    private function setForeignKeyChecks(bool $enabled): void
    {
        match (DB::getDriverName()) {
            'pgsql' => DB::statement(sprintf("SET session_replication_role = '%s'", $enabled ? 'origin' : 'replica')),
            'sqlite' => DB::statement('PRAGMA foreign_keys = ' . ($enabled ? 'ON' : 'OFF')),
            default => DB::statement('SET FOREIGN_KEY_CHECKS = ' . ($enabled ? 1 : 0)),
        };
    }

    private function truncateRelevantTables(): void
    {
        $tables = [
            'audit_logs', 'customers', 'tables', 'reservations',
            'menu_categories', 'menu_items', 'menu_modifiers', 'menu_item_modifiers',
            'menu_combos', 'menu_combo_items', 'suppliers', 'ingredients',
            'recipes', 'recipe_ingredients', 'orders', 'order_items',
            'order_item_modifiers', 'order_status_history', 'kot_tickets',
            'kot_ticket_items', 'invoices', 'payments', 'refunds',
            'discounts', 'cash_register_sessions', 'gift_cards',
            'stock_movements', 'purchase_orders', 'purchase_order_items',
            'wastage', 'outlets', 'staff_shifts', 'shift_schedules',
        ];
        foreach ($tables as $table) {
            DB::table($table)->truncate();
        }
    }

    private function uid(string $prefix, int $num): string
    {
        return sprintf('00000000-0000-0000-0000-%s', substr(md5($prefix . $num), 0, 12));
    }

    private function userSeedPassword(): string
    {
        if ($this->userPassword !== null) {
            return $this->userPassword;
        }

        $password = env('DEMO_USER_PASSWORD');
        if (!$password) {
            $password = Str::random(16);
            $this->command?->warn('No DEMO_USER_PASSWORD env set. Generated demo user password: '.$password);
        }

        return $this->userPassword = $password;
    }

    private function randomFrom(array $arr)
    {
        return $arr[array_rand($arr)];
    }

    private function randomFloat(float $min, float $max, int $decimals = 2): float
    {
        return round($min + mt_rand() / mt_getrandmax() * ($max - $min), $decimals);
    }

    private function randomInt(int $min, int $max): int
    {
        return mt_rand($min, $max);
    }

    private function randomTimestamp(Carbon $start, ?Carbon $end = null): string
    {
        $end = $end ?? $this->now;
        $diff = $end->timestamp - $start->timestamp;
        $random = $start->timestamp + mt_rand(0, max(0, $diff));
        return Carbon::createFromTimestamp($random)->format('Y-m-d H:i:s');
    }

    private function randomDate(Carbon $start, ?Carbon $end = null): string
    {
        $end = $end ?? $this->now;
        $diff = $start->diffInDays($end); // Use start->diffInDays(end) to get positive diff
        return (new Carbon($start))->addDays(mt_rand(0, max(0, $diff)))->format('Y-m-d');
    }

    // ==================== OUTLETS ====================

    private function createOutlets(): void
    {
        $outlets = [
            ['name' => 'Kainan Express - Main Branch', 'address' => '123 MacArthur Highway, Barangay 12, Caloocan City, Metro Manila 1400', 'phone' => '+63 2 8123 4567'],
            ['name' => 'Kainan Express - SM Baliwag', 'address' => '2nd Floor, SM City Baliwag, Don Ramon, Baliwag, Bulacan 3006', 'phone' => '+63 44 789 0123'],
        ];

        foreach ($outlets as $i => $outlet) {
            $id = $this->uid('outlet', $i + 1);
            $this->ids['outlets'][] = $id;
            DB::table('outlets')->insert([
                'id' => $id,
                'name' => $outlet['name'],
                'address' => $outlet['address'],
                'phone' => $outlet['phone'],
                'is_active' => true,
                'created_at' => $this->sevenYearsAgo,
                'updated_at' => $this->sevenYearsAgo,
            ]);
        }
    }

    // ==================== USERS ====================

    private function createUsers(): void
    {
        $adminId = DB::table('users')->where('email', 'admin@rms.com')->value('id');
        $this->ids['users'][] = $adminId;
        $adminRoleId = DB::table('roles')->where('name', 'admin')->value('id');
        if ($adminId && $adminRoleId) {
            $hasAdminRole = DB::table('model_has_roles')->where('model_id', $adminId)->where('role_id', $adminRoleId)->where('model_type', 'App\Models\User')->exists();
            if (! $hasAdminRole) {
                DB::table('model_has_roles')->insert([
                    'role_id' => $adminRoleId,
                    'model_type' => 'App\Models\User',
                    'model_id' => $adminId,
                ]);
            }
        }

        $kitchenRoleId = DB::table('roles')->where('name', 'kitchen_staff')->value('id');
        $jaysonEmail = 'jaysonkitchenstaff@gmail.com';
        $existing = DB::table('users')->where('email', $jaysonEmail)->first();
        if ($existing) {
            $this->ids['users'][] = $existing->id;
            $hasKitchenRole = DB::table('model_has_roles')->where('model_id', $existing->id)->where('role_id', $kitchenRoleId)->where('model_type', 'App\Models\User')->exists();
            if (! $hasKitchenRole && $kitchenRoleId) {
                DB::table('model_has_roles')->insert([
                    'role_id' => $kitchenRoleId,
                    'model_type' => 'App\Models\User',
                    'model_id' => $existing->id,
                ]);
            }
            $existingStaff = DB::table('staff_profiles')->where('user_id', $existing->id)->first();
            if ($existingStaff) {
                $this->ids['staff_profiles'][] = $existingStaff->id;
                return;
            }
            // Staff profile missing (e.g., after operational truncate) — recreate it
            $staffId = $this->uid('staff', 99);
            $this->ids['staff_profiles'][] = $staffId;
            $createdAt = $existing->created_at ?? $this->sevenYearsAgo;
            DB::table('staff_profiles')->insert([
                'id' => $staffId,
                'user_id' => $existing->id,
                'employee_id' => 'EMP-JAYSON01',
                'position' => 'Kitchen Staff',
                'department' => 'Kitchen',
                'hourly_rate' => $this->randomFloat(60, 180),
                'base_salary' => $this->randomFloat(15000, 45000),
                'hire_date' => $this->randomDate($this->sevenYearsAgo),
                'employment_type' => 'full_time',
                'phone' => '09919999999',
                'address' => 'Caloocan City',
                'is_active' => true,
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ]);
            return;
        }

        $id = $this->uid('user', 99);
        $this->ids['users'][] = $id;
        $createdAt = $this->randomTimestamp($this->sevenYearsAgo, (new Carbon($this->sevenYearsAgo))->addMonth());
        DB::table('users')->insert([
            'id' => $id,
            'name' => 'Jayson Statham',
            'email' => $jaysonEmail,
            'password' => Hash::make($this->userSeedPassword()),
            'is_active' => true,
            'email_verified_at' => $createdAt,
            'avatar' => null,
            'last_login_at' => $this->randomTimestamp((new Carbon($this->sevenYearsAgo))->addMonths(5)),
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
        ]);
        DB::table('model_has_roles')->insert([
            'role_id' => $kitchenRoleId,
            'model_type' => 'App\Models\User',
            'model_id' => $id,
        ]);
        $staffId = $this->uid('staff', 99);
        $this->ids['staff_profiles'][] = $staffId;
        DB::table('staff_profiles')->insert([
            'id' => $staffId,
            'user_id' => $id,
            'employee_id' => 'EMP-JAYSON01',
            'position' => 'Kitchen Staff',
            'department' => 'Kitchen',
            'hourly_rate' => $this->randomFloat(60, 180),
            'base_salary' => $this->randomFloat(15000, 45000),
            'hire_date' => $this->randomDate($this->sevenYearsAgo),
            'employment_type' => 'full_time',
            'phone' => '09919999999',
            'address' => 'Caloocan City',
            'is_active' => true,
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
        ]);
    }

    // ==================== CUSTOMERS ====================

    private function createCustomers(): void
    {
        $firstNames = [
            'Juan', 'Maria', 'Jose', 'Ana', 'Pedro', 'Rosa', 'Antonio', 'Luz', 'Manuel', 'Elena',
            'Carlos', 'Teresa', 'Ramon', 'Cecilia', 'Luis', 'Carmen', 'Miguel', 'Josefina', 'Andres', 'Beatriz',
            'Fernando', 'Gloria', 'Ricardo', 'Lourdes', 'Alberto', 'Concepcion', 'Jorge', 'Dolores', 'Vicente', 'Aurora',
            'Eduardo', 'Pilar', 'Rafael', 'Nenita', 'Emilio', 'Corazon', 'Francisco', 'Milagros', 'Gregorio', 'Nieves',
            'Hector', 'Ofelia', 'Ireneo', 'Perla', 'Jaime', 'Querubin', 'Kiko', 'Rosario', 'Leo', 'Salvacion',
            'Mario', 'Teresita', 'Noel', 'Violeta', 'Oscar', 'Zenaida', 'Pablo', 'Imelda', 'Quirino', 'Leticia',
            'Roberto', 'Amparo', 'Samuel', 'Bellinda', 'Teodoro', 'Cristina', 'Ulysses', 'Divina', 'Valentin', 'Esperanza',
            'Wilfredo', 'Fe', 'Xavier', 'Gracia', 'Ysidro', 'Honorata', 'Zosimo', 'Iris', 'Adrian', 'Myla',
            'Benny', 'Nympha', 'Chris', 'Ophelia', 'Danilo', 'Pacita', 'Edwin', 'Rebecca', 'Froilan', 'Susana',
            'Gideon', 'Tiffany', 'Henry', 'Ursula', 'Ivan', 'Vivian', 'Jonathan', 'Wendy', 'Kyle', 'Yumi',
            'Alex', 'Bianca', 'Christian', 'Diana', 'Eric', 'Fiona', 'Gabriel', 'Hannah', 'Ian', 'Jade',
            'Kevin', 'Leah', 'Mark', 'Nina', 'Oliver', 'Paula', 'Quinn', 'Rachel', 'Stephen', 'Tina',
        ];

        $lastNames = [
            'Santos', 'Cruz', 'Reyes', 'Gonzales', 'Dela Cruz', 'Garcia', 'Mendoza', 'Torres', 'Flores', 'Villanueva',
            'Ramos', 'Aquino', 'Castillo', 'Fernandez', 'Romualdez', 'Alvarez', 'Mercado', 'Navarro', 'Salazar', 'Santiago',
            'Tolentino', 'Bautista', 'Lopez', 'Marcos', 'Moreno', 'Rivera', 'Gomez', 'Domingo', 'Valdez', 'Gutierrez',
            'Aguilar', 'David', 'Diaz', 'Lazaro', 'Macapagal', 'Magsaysay', 'Martinez', 'Miranda', 'Pascual', 'Pineda',
            'Quezon', 'Quinto', 'Roldan', 'Rosario', 'Samson', 'Sison', 'Sorianoo', 'Tecson', 'Trinidad', 'Vargas',
            'Abad', 'Agustin', 'Alberto', 'Amado', 'Andres', 'Antonio', 'Aquino', 'Arcilla', 'Bacani', 'Bautista',
        ];

        $streets = ['Rizal Ave', 'McArthur Hwy', 'EDSA', 'Commonwealth Ave', 'Taft Ave', 'Quezon Blvd', 'Ayala Ave',
            'P. Burgos St', 'Mabini St', 'Bonifacio St', 'Luna St', 'Del Pilar St', 'Legarda St', 'Recto Ave'];

        $barangays = ['Barangay 1', 'Barangay 5', 'Barangay 12', 'Barangay 24', 'Barangay 36', 'Barangay 48',
            'Barangay 64', 'Barangay 72', 'Barangay 84', 'Barangay 96', 'Barangay 105', 'Barangay 112'];

        $cities = ['Caloocan City', 'Baliwag', 'Manila', 'Quezon City', 'Mandaluyong', 'Makati', 'Pasig', 'Valenzuela', 'Malolos'];

        // ~3000 customers over 7 years (~1.2 per day average)
        for ($i = 1; $i <= 3000; $i++) {
            $id = $this->uid('customer', $i);
            $this->ids['customers'][] = $id;
            $firstName = $this->randomFrom($firstNames);
            $lastName = $this->randomFrom($lastNames);
            $createdAt = $this->randomTimestamp($this->sevenYearsAgo);

            DB::table('customers')->insert([
                'id' => $id,
                'name' => "$firstName $lastName",
                'email' => strtolower($firstName . '.' . $lastName . $i . '@email.com'),
                'phone' => $this->randomFrom(['0917', '0920', '0927', '0932', '0939']) . sprintf('%07d', mt_rand(0, 9999999)),
                'customer_type' => 'registered',
                'loyalty_points' => $this->randomInt(0, 5000),
                'total_spent' => $this->randomFloat(0, 100000),
                'visit_count' => $this->randomInt(0, 200),
                'no_show_counter' => $this->randomInt(0, 3),
                'partial_show_counter' => $this->randomInt(0, 5),
                'guest_flag_level' => $this->randomInt(0, 2),
                'notes' => null,
                'is_active' => true,
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ]);
        }
    }

    // ==================== MENU CATEGORIES ====================

    private function createMenuCategories(): void
    {
        $categories = [
            ['name' => 'Appetizer', 'sort_order' => 1],
            ['name' => 'Main Course', 'sort_order' => 2],
            ['name' => 'Rice Meals', 'sort_order' => 3],
            ['name' => 'Pasta', 'sort_order' => 4],
            ['name' => 'Seafood', 'sort_order' => 5],
            ['name' => 'Chicken', 'sort_order' => 6],
            ['name' => 'Beef', 'sort_order' => 7],
            ['name' => 'Pork', 'sort_order' => 8],
            ['name' => 'Dessert', 'sort_order' => 9],
            ['name' => 'Coffee', 'sort_order' => 10],
            ['name' => 'Milk Tea', 'sort_order' => 11],
            ['name' => 'Soft Drinks', 'sort_order' => 12],
            ['name' => 'Juice', 'sort_order' => 13],
            ['name' => 'Add-ons', 'sort_order' => 14],
            ['name' => 'Breakfast', 'sort_order' => 15],
        ];

        foreach ($categories as $i => $cat) {
            $id = $this->uid('category', $i + 1);
            $this->ids['categories'][] = $id;
            DB::table('menu_categories')->insert([
                'id' => $id,
                'name' => $cat['name'],
                'slug' => Str::slug($cat['name']),
                'description' => match ($cat['name']) {
                    'Appetizer' => 'Perfect starters to begin your meal',
                    'Main Course' => 'Hearty and filling main dishes',
                    'Rice Meals' => 'Classic rice bowl combinations',
                    'Pasta' => 'Italian-inspired pasta dishes',
                    'Seafood' => 'Fresh daily seafood catches',
                    'Chicken' => 'Tender chicken dishes prepared various ways',
                    'Beef' => 'Premium beef cuts and recipes',
                    'Pork' => 'Traditional Filipino pork dishes',
                    'Dessert' => 'Sweet treats to end your meal',
                    'Coffee' => 'Hot and iced coffee beverages',
                    'Milk Tea' => 'Premium milk tea selections',
                    'Soft Drinks' => 'Refreshing carbonated beverages',
                    'Juice' => 'Fresh fruit juices and shakes',
                    'Add-ons' => 'Extra sides and add-ons',
                    'Breakfast' => 'All-day breakfast favorites',
                    default => null,
                },
                'sort_order' => $cat['sort_order'],
                'is_active' => true,
                'created_at' => $this->sevenYearsAgo,
                'updated_at' => $this->sevenYearsAgo,
            ]);
        }
    }

    // ==================== MENU ITEMS ====================

    private function createMenuItems(): void
    {
        $menuItems = [
            // Appetizer (category 0)
            ['Lumpiang Shanghai', 149, 65, 8, 'Crispy fried spring rolls filled with seasoned ground pork, served with sweet chili dip', 8, true, 320],
            ['Kinilaw na Isda', 189, 82, 10, 'Fresh tuna ceviche marinated in vinegar, calamansi, ginger, and chili', 12, true, 280],
            ['Tokwa\'t Baboy', 139, 58, 5, 'Deep-fried tofu and pork bits with soy-vinegar dipping sauce', 7, false, 360],
            ['Calamares', 179, 76, 8, 'Battered and deep-fried squid rings served with garlic aioli', 10, true, 340],
            ['Siomai (Pork)', 99, 40, 10, 'Steamed pork dumplings with soy-calamansi dipping sauce', 8, true, 290],
            ['Siomai (Shanghai)', 109, 44, 10, 'Shanghai-style steamed pork and shrimp dumplings', 8, false, 300],
            ['Chicharon Bulaklak', 159, 68, 5, 'Crispy pork ruffles served with spiced vinegar', 10, true, 420],
            ['Okoy', 119, 48, 5, 'Shrimp and vegetable fritters with vinegar dip', 7, true, 310],

            // Main Course (category 1)
            ['Chicken Adobo', 229, 98, 12, 'Classic Filipino adobo - chicken braised in soy sauce, vinegar, garlic, and pepper', 15, true, 380],
            ['Pork Adobo', 219, 94, 12, 'Tender pork belly adobo slow-cooked in traditional soy-vinegar marinade', 18, true, 420],
            ['Beef Kaldereta', 289, 124, 12, 'Hearty beef stew in tomato-based sauce with liver spread, bell peppers, and potatoes', 20, true, 450],
            ['Chicken Tinola', 209, 88, 12, 'Ginger-flavored chicken soup with green papaya and chili leaves', 15, true, 340],
            ['Pork Sinigang', 239, 102, 12, 'Sour tamarind soup with pork belly, kangkong, and radish', 18, true, 360],
            ['Beef Bulalo', 329, 142, 12, 'Rich beef marrow stew with corn, cabbage, and potatoes', 25, true, 480],
            ['Lechon Kawali', 249, 108, 12, 'Double-fried crispy pork belly served with liver sauce and pickled papaya', 20, true, 520],
            ['Chicken Curry', 239, 102, 12, 'Filipino-style chicken curry with coconut milk, potatoes, and bell peppers', 18, true, 410],

            // Rice Meals (category 2)
            ['Garlic Rice', 49, 18, 12, 'Fried rice infused with toasted garlic', 3, true, 250],
            ['Java Rice', 59, 22, 12, 'Yellow rice cooked with turmeric and annatto', 3, true, 260],
            ['Chicken Brest Inasal w/ Rice', 199, 85, 12, 'Grilled chicken breast marinated in annatto and calamansi, served with garlic rice', 12, true, 480],
            ['Pork BBQ Stick w/ Rice', 169, 72, 12, 'Grilled pork skewers with sweet barbecue glaze, served with java rice', 10, true, 450],
            ['Bangsilog', 189, 80, 12, 'Bangus (milkfish) daing with garlic rice and fried egg', 10, true, 520],
            ['Tapsilog', 179, 76, 12, 'Beef tapa with garlic rice and fried egg', 10, true, 540],
            ['Longsilog', 159, 68, 12, 'Sweet longganisa sausage with garlic rice and fried egg', 8, true, 510],
            ['Tosilog', 149, 62, 12, 'Tocino (sweet cured pork) with garlic rice and fried egg', 8, true, 500],

            // Pasta (category 3)
            ['Carbonara', 219, 92, 12, 'Creamy bacon carbonara with parmesan cheese and fresh cream', 12, true, 520],
            ['Spaghetti Bolognese', 199, 84, 12, 'Italian-style spaghetti with rich meat sauce', 12, true, 490],
            ['Pesto Chicken Pasta', 229, 96, 12, 'Basil pesto pasta with grilled chicken strips and cherry tomatoes', 12, true, 480],
            ['Baked Macaroni', 239, 102, 12, 'Oven-baked macaroni with ground beef, cheese, and creamy sauce', 18, true, 550],
            ['Seafood Marinara', 269, 114, 12, 'Linguine with shrimp, squid, mussels in tomato marinara sauce', 15, true, 440],
            ['Lasagna', 259, 110, 12, 'Classic lasagna with layers of pasta, beef, bechamel, and mozzarella', 18, true, 560],

            // Seafood (category 4)
            ['Grilled Tanigue', 299, 128, 12, 'Grilled Spanish mackerel marinated in soy-calamansi, served with ensalada', 15, true, 380],
            ['Sweet & Sour Fish Fillet', 259, 110, 12, 'Crispy fried fish fillet with sweet and sour sauce', 15, true, 410],
            ['Buttered Shrimp', 289, 124, 12, 'Succulent shrimp sautéed in garlic butter sauce', 12, true, 360],
            ['Sinigang na Hipon', 269, 114, 12, 'Shrimp sinigang in sour tamarind broth with vegetables', 15, true, 320],
            ['Paksiw na Bangus', 219, 92, 12, 'Milkfish cooked in vinegar, ginger, and garlic', 15, true, 380],
            ['Inihaw na Pusit', 279, 118, 12, 'Grilled stuffed squid with tomato-onion filling', 15, true, 350],

            // Chicken (category 5)
            ['Fried Chicken (4 pcs)', 249, 106, 12, 'Crispy golden fried chicken - 4 pieces', 15, true, 620],
            ['Chicken Wings (6 pcs)', 229, 98, 12, 'Buffalo-style chicken wings with dipping sauce', 12, true, 540],
            ['Grilled Chicken BBQ', 219, 92, 12, 'Grilled chicken barbecue with homemade marinade', 15, true, 460],
            ['Chicken Sisig', 199, 84, 12, 'Sizzling chopped chicken sisig with onion and calamansi', 10, true, 420],
            ['Chicken Ala King', 229, 96, 12, 'Chicken breast in creamy mushroom sauce with bell peppers', 12, true, 400],
            ['Sweet and Sour Chicken', 219, 92, 12, 'Breaded chicken chunks in sweet and sour sauce with pineapple', 12, true, 450],

            // Beef (category 6)
            ['Beef Tapa', 249, 106, 12, 'Marinated and cured beef, pan-fried to perfection', 12, true, 480],
            ['Beef Bulalo Steak', 349, 150, 12, 'Pan-seared beef marrow steak with mushroom gravy', 22, true, 520],
            ['Beef Morcon', 319, 136, 12, 'Stuffed beef roll with pickles, carrots, and cheese in tomato sauce', 25, true, 460],
            ['Beef Mechado', 269, 114, 12, 'Beef stewed in tomato sauce with potatoes, carrots, and bell peppers', 20, true, 440],
            ['Beef Salpicao', 289, 124, 12, 'Garlicky beef cubes with butter and worcestershire sauce', 12, true, 490],
            ['Kare-Kare', 299, 128, 12, 'Oxtail and tripe in peanut sauce with vegetables and bagoong', 25, true, 530],

            // Pork (category 7)
            ['Crispy Pata', 399, 172, 12, 'Deep-fried whole pork leg served with soy-vinegar dip', 30, true, 680],
            ['Lechon Kawali', 229, 98, 12, 'Crispy deep-fried pork belly cuts', 18, true, 560],
            ['Pork Sisig', 199, 84, 12, 'Sizzling chopped pork face and ears with chili and calamansi', 10, true, 480],
            ['Bicol Express', 219, 94, 12, 'Pork belly cooked in coconut milk with green chili', 15, true, 460],
            ['Humba', 239, 102, 12, 'Braised pork belly in soy sauce, vinegar, and pineapple', 20, true, 500],
            ['Pork Steak', 219, 92, 12, 'Filipino-style pork steak in soy-calamansi sauce with onions', 12, true, 440],

            // Dessert (category 8)
            ['Halo-Halo', 129, 52, 12, 'Classic Filipino shaved ice dessert with mix of toppings and leche flan', 5, true, 340],
            ['Leche Flan', 89, 36, 12, 'Creamy caramel custard dessert', 60, true, 280],
            ['Buko Pandan', 79, 32, 12, 'Chilled coconut and pandan gelatin dessert', 5, true, 220],
            ['Mango Sago', 99, 40, 12, 'Fresh mangoes with sago pearls and creamy milk', 5, true, 260],
            ['Turon', 69, 28, 12, 'Deep-fried banana spring roll with caramelized sugar', 8, true, 240],
            ['Puto Bumbong', 89, 36, 12, 'Steamed purple rice cake with coconut and brown sugar', 10, false, 310],
            ['Bibingka', 99, 40, 12, 'Rice cake baked with salted egg and cheese', 12, true, 330],
            ['Suman sa Lihia', 59, 24, 12, 'Sticky rice wrapped in banana leaf with coconut caramel', 5, true, 290],

            // Coffee (category 9)
            ['Brewed Coffee', 69, 18, 12, 'Freshly brewed local coffee blend', 2, true, 5],
            ['Cafe Latte', 119, 36, 12, 'Espresso with steamed milk', 3, true, 120],
            ['Cappuccino', 119, 36, 12, 'Espresso with foamed milk and cinnamon', 3, true, 130],
            ['Spanish Latte', 139, 42, 12, 'Espresso with condensed milk', 3, true, 160],
            ['Caramel Macchiato', 149, 46, 12, 'Vanilla latte with caramel drizzle', 3, true, 180],
            ['Mocha Frappe', 159, 48, 12, 'Blended chocolate coffee drink with whipped cream', 4, true, 320],
            ['Americano', 89, 22, 12, 'Espresso diluted with hot water', 2, true, 10],
            ['Matcha Latte', 139, 42, 12, 'Japanese green tea with steamed milk', 3, true, 140],

            // Milk Tea (category 10)
            ['Classic Milk Tea', 89, 34, 12, 'Premium black milk tea with chewy tapioca pearls', 4, true, 240],
            ['Taro Milk Tea', 99, 38, 12, 'Creamy taro flavored milk tea', 4, true, 260],
            ['Wintermelon Milk Tea', 99, 38, 12, 'Wintermelon flavored milk tea', 4, true, 250],
            ['Okinawa Milk Tea', 109, 42, 12, 'Brown sugar milk tea with creamy finish', 4, true, 270],
            ['Matcha Milk Tea', 109, 42, 12, 'Green tea milk tea', 4, true, 250],
            ['Strawberry Milk Tea', 109, 42, 12, 'Strawberry flavored milk tea', 4, true, 260],

            // Soft Drinks (category 11)
            ['Coca-Cola (Can)', 39, 14, 6, '330ml can', 1, true, 140],
            ['Sprite (Can)', 39, 14, 6, '330ml can', 1, true, 140],
            ['Royal (Can)', 39, 14, 6, '330ml can', 1, true, 140],
            ['Root Beer (Can)', 45, 16, 6, '330ml can', 1, true, 150],
            ['Iced Tea', 49, 18, 6, 'House-brewed iced tea', 1, true, 120],
            ['Coca-Cola (Bottle)', 59, 22, 6, '500ml bottle', 1, true, 200],
            ['Mineral Water', 29, 8, 6, '500ml bottle', 1, true, 0],

            // Juice (category 12)
            ['Calamansi Juice', 59, 22, 12, 'Freshly squeezed calamansi juice', 2, true, 90],
            ['Fresh Buko Juice', 69, 26, 6, 'Chilled young coconut juice with pulp', 2, true, 80],
            ['Mango Shake', 89, 34, 12, 'Fresh mango blended with milk', 3, true, 180],
            ['Watermelon Shake', 89, 34, 12, 'Fresh watermelon blended smooth', 3, true, 150],
            ['Pineapple Juice', 69, 26, 6, 'Fresh pineapple juice', 2, true, 130],
            ['Four Seasons Juice', 79, 30, 12, 'Blend of calamansi, guyabano, and pineapple', 2, true, 140],

            // Add-ons (category 13)
            ['Extra Rice', 25, 8, 12, 'Additional serving of steamed or garlic rice', 2, true, 220],
            ['Extra Sauce', 19, 6, 12, 'Extra serving of sauce', 1, true, 30],
            ['Fried Egg', 25, 8, 12, 'Additional fried egg', 2, true, 80],
            ['Extra Cheese', 35, 14, 12, 'Additional cheese topping', 1, true, 60],
            ['Sour Cream', 29, 10, 12, 'Sour cream topping', 1, true, 50],
            ['Bacon Bits', 39, 16, 12, 'Crispy bacon crumbles', 1, true, 90],

            // Breakfast (category 14)
            ['Silog Breakfast - Tapa', 179, 76, 12, 'Beef tapa with garlic rice and fried egg', 10, true, 520],
            ['Silog Breakfast - Longga', 159, 68, 12, 'Sweet longganisa with garlic rice and egg', 10, true, 510],
            ['Silog Breakfast - Tocino', 159, 68, 12, 'Sweet cured pork with garlic rice and egg', 10, true, 500],
            ['Silog Breakfast - Daing', 189, 80, 12, 'Fried marinated fish with garlic rice and egg', 12, true, 480],
            ['Silog Breakfast - Corned', 169, 72, 12, 'Corned beef with garlic rice and fried egg', 10, true, 490],
            ['Pancake with Honey', 129, 52, 12, 'Fluffy pancakes drizzled with honey and butter', 8, true, 420],
            ['French Toast', 139, 56, 12, 'Golden french toast with syrup and fresh fruits', 8, true, 400],
            ['Oatmeal with Fruits', 119, 44, 12, 'Warm oatmeal topped with fresh banana and mango', 5, true, 280],
        ];

        // Local cleanup: retain exactly 60 items (4 per category block) = 3 pages at 20/page.
        $retainedMenu = [0, 1, 2, 3, 8, 9, 10, 11, 16, 17, 18, 19, 24, 25, 26, 27, 30, 31, 32, 33, 36, 37, 38, 39, 42, 43, 44, 45, 48, 49, 50, 51, 54, 55, 56, 57, 62, 63, 64, 65, 70, 71, 72, 73, 76, 77, 78, 79, 83, 84, 85, 86, 89, 90, 91, 92, 95, 96, 97, 98];
        foreach ($menuItems as $i => $item) {
            if (! in_array($i, $retainedMenu, true)) {
                continue;
            }
            $id = $this->uid('menuitem', $i + 1);
            $this->ids['menu_items'][] = $id;
            $this->ids['menu_map'][$i] = $id;

            $catIdx = 0;
            $cumulative = 0;
            $catSizes = [8, 8, 8, 6, 6, 6, 6, 6, 8, 8, 6, 7, 6, 6, 8];
            foreach ($catSizes as $ci => $size) {
                if ($i < $cumulative + $size) { $catIdx = $ci; break; }
                $cumulative += $size;
            }

            DB::table('menu_items')->insert([
                'id' => $id,
                'category_id' => $this->ids['categories'][$catIdx],
                'name' => $item[0],
                'slug' => Str::slug($item[0]) . '-' . ($i + 1),
                'description' => $item[4],
                'price' => $item[1],
                'sku' => 'KE-' . str_pad((string)($i + 1), 4, '0', STR_PAD_LEFT),
                'is_available' => $item[6],
                'is_featured' => false,
                'cost_price' => $item[2],
                'prep_time_minutes' => $item[3],
                'tags' => json_encode([match(true) {
                    $item[1] < 100 => 'budget',
                    $item[1] < 200 => 'affordable',
                    $item[1] < 300 => 'premium',
                    default => 'signature',
                }]),
                'created_at' => $this->sevenYearsAgo,
                'updated_at' => $this->sevenYearsAgo,
            ]);
        }
    }

    // ==================== SUPPLIERS ====================

    private function createSuppliers(): void
    {
        $suppliers = [
            ['Puregold Caloocan', 'Roberto Tan', '09170001111', 'roberto.tan@puregold.com.ph', 'Puregold Supermarket, Caloocan City'],
            ['SM Hypermarket Baliwag', 'Catherine Santos', '09170002222', 'catherine.santos@smhypermarket.com', 'SM City Baliwag, Bulacan'],
            ['Monterey Meat Shop', 'Antonio Mercado', '09170003333', 'antonio@monterey.com.ph', 'Monterey Meat Shop, Quezon City'],
            ['Magnolia Chicken', 'Luzviminda Cruz', '09170004444', 'luz@magnolia.com.ph', 'Magnolia Poultry, Malolos, Bulacan'],
            ['Ocean Fresh Seafood', 'Felipe Reyes', '09170005555', 'felipe@oceanfresh.com', 'Navotas Fish Port, Navotas City'],
            ['Farm Fresh Produce', 'Maria Gonzales', '09170006666', 'maria@farmfresh.com', 'Baliuag Vegetable Market, Bulacan'],
            ['Dairy Queen Supplies', 'Eduardo Lopez', '09170007777', 'eduardo@dairyqueensupplies.com', 'Dairy Farm, Sta. Maria, Bulacan'],
            ['Golden Grain Rice Mill', 'Pedro Fernandez', '09170008888', 'pedro@goldengrain.com', 'San Jose Del Monte, Bulacan'],
            ['Bayanihan Coffee Roasters', 'Sofia Bautista', '09170009999', 'sofia@bayanihancoffee.com', 'Baguio City Export Zone'],
            ['San Miguel Beverages', 'Ramon Ang Jr', '09170001010', 'ramon.jr@sanmiguel.com', 'San Miguel Brewery, Manila'],
            ['Philippine Tea Company', 'David Chua', '09170001111', 'david@philtea.com', 'Tea Processing Plant, Lipa City'],
            ['Fresh Start Dairy', 'Linda Aquino', '09170001212', 'linda@freshstartdairy.com', 'Dairy Farm, Laguna'],
            ['Golden Eggs Poultry', 'Jose Villanueva', '09170001313', 'jose@goldeneggs.com', 'Poultry Farm, Bulacan'],
            ['Luzon Spice Traders', 'Miguel Ramos', '09170001414', 'miguel@luzonspice.com', 'Spice Market, Divisoria, Manila'],
            ['Prima Foods Inc', 'Carmen Garcia', '09170001515', 'carmen@primafoods.com', 'Food Processing Plant, Valenzuela'],
        ];

        foreach ($suppliers as $i => $supplier) {
            $id = $this->uid('supplier', $i + 1);
            $this->ids['suppliers'][] = $id;
            DB::table('suppliers')->insert([
                'id' => $id,
                'name' => $supplier[0],
                'contact_person' => $supplier[1],
                'phone' => $supplier[2],
                'email' => $supplier[3],
                'address' => $supplier[4],
                'payment_terms' => $this->randomFrom(['Net 15', 'Net 30', 'Net 45', 'COD', '7 Days']),
                'rating' => $this->randomFloat(3.0, 5.0, 1),
                'is_active' => true,
                'created_at' => $this->sevenYearsAgo,
                'updated_at' => $this->sevenYearsAgo,
            ]);
        }
    }

    // ==================== INGREDIENTS ====================

    private function createIngredients(): void
    {
        $ingredients = [
            ['Chicken Breast', 'Meat', 'kg', 50, 10, 200, 4],
            ['Pork Belly', 'Meat', 'kg', 40, 8, 150, 3],
            ['Beef Brisket', 'Meat', 'kg', 30, 5, 100, 3],
            ['Ground Pork', 'Meat', 'kg', 25, 5, 80, 4],
            ['Pork Leg', 'Meat', 'kg', 15, 3, 50, 3],
            ['Pork Face', 'Meat', 'kg', 10, 3, 40, 1],
            ['Beef Tapa', 'Meat', 'kg', 20, 4, 60, 3],
            ['Chicken Wings', 'Meat', 'kg', 35, 8, 120, 4],
            ['Beef Marrow Bones', 'Meat', 'kg', 25, 5, 80, 3],
            ['Longganisa', 'Meat', 'kg', 30, 6, 100, 3],
            ['Tocino', 'Meat', 'kg', 28, 5, 90, 3],
            ['Corned Beef', 'Pantry', 'cans', 60, 20, 200, 5],
            ['Bangus (Milkfish)', 'Seafood', 'kg', 25, 5, 80, 5],
            ['Tanigue (Mackerel)', 'Seafood', 'kg', 20, 4, 60, 5],
            ['Shrimp (Medium)', 'Seafood', 'kg', 15, 3, 50, 5],
            ['Squid', 'Seafood', 'kg', 18, 4, 55, 5],
            ['Tuna (Fresh)', 'Seafood', 'kg', 20, 4, 60, 5],
            ['Fish Fillet (Dory)', 'Seafood', 'kg', 30, 6, 90, 5],
            ['Mussels', 'Seafood', 'kg', 15, 3, 45, 5],
            ['Eggs', 'Dairy & Eggs', 'pcs', 500, 50, 2000, 12],
            ['Fresh Milk', 'Dairy & Eggs', 'L', 40, 10, 100, 10],
            ['Evaporated Milk', 'Dairy & Eggs', 'cans', 80, 20, 200, 10],
            ['Condensed Milk', 'Dairy & Eggs', 'cans', 60, 15, 180, 10],
            ['Cheddar Cheese', 'Dairy & Eggs', 'kg', 10, 3, 30, 7],
            ['Cream Cheese', 'Dairy & Eggs', 'kg', 8, 2, 25, 7],
            ['Butter', 'Dairy & Eggs', 'kg', 15, 4, 50, 7],
            ['Cooking Oil', 'Pantry', 'L', 60, 20, 200, 8],
            ['Canola Oil', 'Pantry', 'L', 40, 10, 120, 8],
            ['Soy Sauce', 'Condiments', 'L', 30, 10, 80, 9],
            ['Vinegar', 'Condiments', 'L', 35, 10, 90, 9],
            ['Fish Sauce (Patis)', 'Condiments', 'L', 20, 5, 60, 9],
            ['Oyster Sauce', 'Condiments', 'L', 25, 5, 70, 9],
            ['Calamansi Juice', 'Condiments', 'L', 15, 3, 40, 11],
            ['Garlic', 'Vegetables', 'kg', 15, 5, 60, 12],
            ['Onion (Red)', 'Vegetables', 'kg', 25, 8, 80, 12],
            ['Onion (White)', 'Vegetables', 'kg', 20, 6, 70, 12],
            ['Ginger', 'Vegetables', 'kg', 12, 3, 40, 12],
            ['Tomato', 'Vegetables', 'kg', 30, 8, 100, 6],
            ['Potato', 'Vegetables', 'kg', 50, 15, 150, 6],
            ['Carrot', 'Vegetables', 'kg', 35, 10, 120, 6],
            ['Bell Pepper', 'Vegetables', 'kg', 20, 5, 60, 6],
            ['Cabbage', 'Vegetables', 'kg', 25, 8, 80, 6],
            ['Kangkong', 'Vegetables', 'kg', 20, 5, 60, 6],
            ['Green Papaya', 'Vegetables', 'kg', 15, 4, 40, 6],
            ['Radish (Labanos)', 'Vegetables', 'kg', 10, 3, 30, 6],
            ['Pechay', 'Vegetables', 'kg', 18, 5, 50, 6],
            ['Lettuce', 'Vegetables', 'kg', 15, 4, 45, 6],
            ['Cucumber', 'Vegetables', 'kg', 20, 5, 55, 6],
            ['Corn', 'Vegetables', 'kg', 25, 6, 80, 7],
            ['Pineapple', 'Fruits', 'kg', 15, 3, 50, 7],
            ['Mango (Ripe)', 'Fruits', 'kg', 20, 5, 60, 6],
            ['Mango (Unripe)', 'Fruits', 'kg', 15, 3, 40, 6],
            ['Watermelon', 'Fruits', 'kg', 10, 2, 30, 6],
            ['Coconut (Young)', 'Fruits', 'pcs', 50, 10, 150, 5],
            ['Coconut (Mature)', 'Fruits', 'pcs', 30, 5, 80, 5],
            ['Banana (Saba)', 'Fruits', 'kg', 25, 8, 80, 6],
            ['Rice (Jasmine)', 'Grains', 'kg', 100, 30, 300, 8],
            ['Rice (Garlic Fried)', 'Grains', 'kg', 40, 10, 100, 8],
            ['Spaghetti Pasta', 'Pantry', 'kg', 15, 5, 50, 8],
            ['Lasagna Sheets', 'Pantry', 'kg', 10, 3, 30, 8],
            ['Breadcrumbs', 'Pantry', 'kg', 8, 2, 25, 8],
            ['Flour', 'Pantry', 'kg', 30, 10, 100, 8],
            ['Sugar (White)', 'Pantry', 'kg', 40, 15, 120, 8],
            ['Sugar (Brown)', 'Pantry', 'kg', 25, 8, 80, 8],
            ['Salt', 'Spices & Herbs', 'kg', 10, 3, 30, 8],
            ['Pepper (Ground)', 'Spices & Herbs', 'kg', 5, 1, 15, 9],
            ['Bay Leaf', 'Spices & Herbs', 'kg', 3, 1, 10, 9],
            ['Chili (Siling Labuyo)', 'Spices & Herbs', 'kg', 5, 1, 15, 6],
            ['Turmeric (Luyang Dilaw)', 'Spices & Herbs', 'kg', 5, 1, 15, 12],
            ['Annatto Seeds', 'Spices & Herbs', 'kg', 3, 1, 10, 9],
            ['Tapioca Pearls', 'Pantry', 'kg', 10, 3, 30, 8],
            ['Coffee Beans', 'Beverages', 'kg', 15, 4, 50, 9],
            ['Matcha Powder', 'Beverages', 'kg', 5, 1, 15, 9],
            ['Tea Leaves', 'Beverages', 'kg', 8, 2, 25, 10],
            ['Taro Powder', 'Beverages', 'kg', 6, 1, 18, 10],
            ['Chocolate Syrup', 'Beverages', 'L', 10, 3, 30, 10],
            ['Caramel Syrup', 'Beverages', 'L', 8, 2, 25, 10],
            ['Vanilla Extract', 'Spices & Herbs', 'L', 3, 1, 10, 8],
            ['Baking Powder', 'Spices & Herbs', 'kg', 5, 1, 15, 8],
            ['Calamansi (Fresh)', 'Fruits', 'kg', 12, 3, 35, 6],
            ['Cooking Wine', 'Pantry', 'L', 8, 2, 25, 8],
        ];

        // Local cleanup: retain 40 ingredients covering every retained recipe's main ingredient.
        $retainedIng = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 19, 21, 22, 24, 26, 27, 28, 29, 32, 34, 51, 52, 53, 57, 58, 62, 63, 64, 69, 70, 72, 73, 75];
        foreach ($ingredients as $i => $ing) {
            if (! in_array($i, $retainedIng, true)) {
                continue;
            }
            $id = $this->uid('ingredient', $i + 1);
            $this->ids['ingredients'][] = $id;
            $this->ids['ingredient_map'][$i] = $id;
            $supplierIdx = $ing[6] - 1;
            DB::table('ingredients')->insert([
                'id' => $id,
                'name' => $ing[0],
                'sku' => 'ING-' . str_pad((string)($i + 1), 3, '0', STR_PAD_LEFT),
                'category' => $ing[1],
                'unit' => $ing[2],
                'current_stock' => $ing[3],
                'minimum_stock' => $ing[4],
                'maximum_stock' => $ing[5],
                'cost_per_unit' => $this->randomFloat(15, 350),
                'supplier_id' => $this->ids['suppliers'][$supplierIdx],
                'storage_location' => match ($ing[1]) {
                    'Meat' => 'Freezer - Section A',
                    'Seafood' => 'Freezer - Section B',
                    'Dairy' => 'Chiller - Section C',
                    'Produce' => 'Chiller - Section D',
                    'Condiments' => 'Dry Storage - Shelf 1',
                    'Seasoning' => 'Dry Storage - Shelf 2',
                    'Beverage' => 'Dry Storage - Shelf 3',
                    'Baking' => 'Dry Storage - Shelf 4',
                    'Pantry' => 'Dry Storage - Shelf 5',
                    'Canned' => 'Dry Storage - Shelf 6',
                    'Grains' => 'Dry Storage - Shelf 7',
                    default => 'Dry Storage',
                },
                'is_active' => true,
                'created_at' => $this->sevenYearsAgo,
                'updated_at' => $this->sevenYearsAgo,
            ]);
        }
    }

    // ==================== RECIPES ====================

    private function createRecipes(): void
    {
        $recipeData = [
            [0, [[0,0.250, 0,0.015, 28,0.010, 63,0.005, 29,0.010]]],  // Lumpiang Shanghai
            [1, [[16,0.200, 32,0.030, 34,0.010, 36,0.010, 64,0.005]]], // Kinilaw
            [2, [[1,0.200, 59,0.100, 34,0.010, 29,0.020, 62,0.005]]],  // Tokwa\'t Baboy
            [3, [[15,0.200, 59,0.100, 64,0.005, 69,0.010, 27,0.050]]], // Calamares
            [4, [[3,0.150, 59,0.080, 34,0.010, 36,0.005, 60,0.020]]],  // Siomai Pork
            [5, [[3,0.100, 17,0.100, 60,0.020, 34,0.010, 63,0.005]]],  // Siomai Shanghai
            [6, [[1,0.250, 27,0.100, 29,0.015, 34,0.010, 64,0.005]]],  // Chicharon Bulaklak
            [7, [[15,0.100, 59,0.100, 27,0.050, 64,0.005, 19,1.000]]], // Okoy

            [8, [[0,0.400, 28,0.060, 29,0.060, 34,0.010, 65,0.003, 63,0.003]]], // Chicken Adobo
            [9, [[1,0.400, 28,0.060, 29,0.060, 34,0.010, 65,0.003, 63,0.003]]], // Pork Adobo
            [10, [[2,0.350, 38,0.150, 39,0.100, 40,0.080, 31,0.040, 34,0.010]]], // Beef Kaldereta
            [11, [[0,0.350, 36,0.020, 43,0.200, 34,0.010, 31,0.020, 44,0.100]]], // Chicken Tinola
            [12, [[1,0.350, 38,0.100, 41,0.080, 44,0.080, 36,0.010, 42,0.100]]], // Pork Sinigang
            [13, [[2,0.400, 8,0.300, 49,0.150, 39,0.100, 41,0.080, 42,0.100]]], // Beef Bulalo
            [14, [[1,0.350, 27,0.100, 34,0.010, 64,0.005, 29,0.020]]], // Lechon Kawali
            [15, [[0,0.350, 21,0.200, 39,0.100, 40,0.080, 34,0.010, 69,0.005]]], // Chicken Curry

            [16, [[57,0.200, 34,0.010, 27,0.020]]], // Garlic Rice
            [17, [[57,0.200, 68,0.005, 27,0.020, 64,0.003]]], // Java Rice
            [18, [[0,0.250, 32,0.020, 27,0.030, 68,0.005, 64,0.003]]], // Chicken Inasal
            [19, [[1,0.200, 28,0.030, 32,0.020, 34,0.010, 27,0.020]]], // Pork BBQ
            [20, [[12,0.250, 27,0.050, 57,0.200, 34,0.010, 19,1.000]]], // Bangsilog
            [21, [[6,0.200, 28,0.020, 34,0.010, 57,0.200, 19,1.000]]],  // Tapsilog
            [22, [[9,0.200, 27,0.020, 57,0.200, 19,1.000]]], // Longsilog
            [23, [[10,0.200, 57,0.200, 19,1.000, 27,0.020]]], // Tosilog

            [24, [[58,0.250, 23,0.100, 26,0.050, 19,0.020, 34,0.005]]], // Carbonara
            [25, [[58,0.250, 3,0.150, 38,0.080, 39,0.060, 28,0.020, 34,0.010]]], // Spag Bol
            [26, [[58,0.250, 0,0.150, 26,0.030, 34,0.005, 38,0.050]]], // Pesto Chicken
            [27, [[58,0.250, 3,0.150, 23,0.100, 26,0.020, 24,0.050]]], // Baked Mac
            [28, [[58,0.250, 14,0.100, 15,0.080, 18,0.100, 38,0.080]]], // Seafood Marinara
            [29, [[59,0.200, 3,0.150, 23,0.100, 24,0.080, 38,0.080]]], // Lasagna

            [30, [[13,0.300, 32,0.030, 27,0.050, 34,0.010, 64,0.005]]], // Grilled Tanigue
            [31, [[17,0.250, 27,0.080, 28,0.030, 37,0.080, 38,0.050]]], // Sweet & Sour Fish
            [32, [[14,0.250, 26,0.050, 34,0.010, 32,0.020, 63,0.003]]], // Buttered Shrimp
            [33, [[14,0.250, 38,0.080, 44,0.080, 36,0.010, 42,0.080]]], // Sinigang na Hipon
            [34, [[12,0.350, 29,0.060, 36,0.010, 34,0.010, 63,0.003]]], // Paksiw na Bangus
            [35, [[15,0.300, 38,0.100, 35,0.080, 27,0.030, 63,0.003]]], // Inihaw na Pusit

            [36, [[0,0.600, 59,0.200, 64,0.010, 63,0.005, 27,0.200]]], // Fried Chicken
            [37, [[7,0.600, 28,0.050, 34,0.010, 63,0.005, 27,0.200]]], // Chicken Wings
            [38, [[0,0.350, 28,0.040, 32,0.020, 34,0.010, 69,0.005]]], // Grilled Chicken BBQ
            [39, [[0,0.300, 35,0.080, 32,0.020, 69,0.010, 26,0.030]]], // Chicken Sisig
            [40, [[0,0.250, 22,0.100, 40,0.060, 38,0.060, 26,0.020]]], // Chicken Ala King
            [41, [[0,0.300, 27,0.080, 50,0.080, 40,0.060, 28,0.030]]], // Sweet & Sour Chicken

            [42, [[6,0.250, 28,0.020, 34,0.010, 27,0.030, 63,0.003]]], // Beef Tapa
            [43, [[8,0.350, 26,0.020, 27,0.050, 34,0.010, 63,0.003]]], // Beef Bulalo Steak
            [44, [[2,0.300, 24,0.050, 39,0.060, 40,0.050, 38,0.080]]], // Beef Morcon
            [45, [[2,0.350, 38,0.100, 39,0.080, 40,0.060, 28,0.020]]], // Beef Mechado
            [46, [[2,0.300, 26,0.030, 34,0.010, 27,0.020, 31,0.020]]], // Beef Salpicao
            [47, [[2,0.250, 1,0.200, 42,0.100, 39,0.080, 31,0.030]]],  // Kare-Kare

            [48, [[4,1.200, 27,0.300, 34,0.020, 63,0.005, 65,0.003]]], // Crispy Pata
            [49, [[1,0.350, 27,0.080, 34,0.010, 64,0.005, 29,0.015]]], // Lechon Kawali
            [50, [[5,0.300, 35,0.080, 69,0.010, 32,0.020, 26,0.020]]], // Pork Sisig
            [51, [[1,0.300, 21,0.200, 69,0.020, 36,0.010, 34,0.005]]], // Bicol Express
            [52, [[1,0.350, 28,0.040, 29,0.030, 50,0.080, 34,0.010]]], // Humba
            [53, [[1,0.300, 28,0.030, 32,0.020, 35,0.080, 63,0.003]]], // Pork Steak

            [54, [[52,0.100, 22,0.050, 23,0.050, 55,0.050, 21,0.050, 50,0.030, 46,0.020]]], // Halo-Halo
            [55, [[22,0.200, 19,0.100, 62,0.100, 21,0.050]]], // Leche Flan
            [56, [[21,0.100, 53,0.100, 62,0.050, 22,0.050]]], // Buko Pandan
            [57, [[51,0.150, 21,0.100, 62,0.050, 19,0.020]]], // Mango Sago
            [58, [[55,0.200, 59,0.050, 62,0.030, 27,0.050]]], // Turon
            [59, [[57,0.200, 62,0.030, 53,0.050, 19,0.020]]], // Puto Bumbong
            [60, [[57,0.200, 19,0.050, 24,0.050, 62,0.030, 26,0.020]]], // Bibingka
            [61, [[57,0.200, 54,0.100, 62,0.050, 64,0.003]]], // Suman

            [62, [[70,0.020]]], // Brewed Coffee
            [63, [[70,0.018, 21,0.150]]], // Cafe Latte
            [64, [[70,0.018, 21,0.150]]], // Cappuccino
            [65, [[70,0.018, 23,0.050, 21,0.100]]], // Spanish Latte
            [66, [[70,0.018, 73,0.030, 21,0.150]]], // Caramel Macchiato
            [67, [[70,0.018, 74,0.030, 21,0.100, 63,0.020]]], // Mocha Frappe
            [68, [[70,0.021]]], // Americano
            [69, [[71,0.020, 21,0.150]]], // Matcha Latte

            [70, [[72,0.030, 69,0.050, 21,0.100, 62,0.030]]], // Classic Milk Tea
            [71, [[73,0.030, 69,0.050, 21,0.100, 62,0.030]]], // Taro Milk Tea
            [72, [[72,0.030, 69,0.050, 21,0.100, 62,0.030]]], // Wintermelon
            [73, [[72,0.030, 69,0.050, 21,0.100, 62,0.030, 63,0.020]]], // Okinawa
            [74, [[71,0.020, 69,0.050, 21,0.100]]], // Matcha Milk Tea
            [75, [[72,0.030, 69,0.050, 21,0.100, 76,0.020]]], // Strawberry MT

            [76, [[75,0.330]]], // Coke Can
            [77, [[75,0.330]]], // Sprite Can
            [78, [[75,0.330]]], // Royal Can
            [79, [[75,0.330]]], // Root Beer
            [80, [[72,0.020, 62,0.020]]], // Iced Tea
            [81, [[75,0.500]]], // Coke Bottle
            [82, [[75,0.500]]], // Water

            [83, [[32,0.100, 62,0.030, 27,0.010]]], // Calamansi Juice
            [84, [[53,0.200, 62,0.020]]], // Buko Juice
            [85, [[51,0.200, 21,0.100, 62,0.030]]], // Mango Shake
            [86, [[52,0.200, 62,0.020]]], // Watermelon Shake
            [87, [[50,0.200, 62,0.020]]], // Pineapple Juice
            [88, [[32,0.050, 50,0.050, 51,0.050, 62,0.020]]], // Four Seasons

            [89, [[57,0.150, 27,0.010]]], // Extra Rice
            [90, [[28,0.050]]], // Extra Sauce
            [91, [[19,1.000, 27,0.020]]], // Fried Egg
            [92, [[24,0.050]]], // Extra Cheese
            [93, [[21,0.050]]], // Sour Cream
            [94, [[1,0.050, 27,0.010]]], // Bacon Bits

            [95, [[6,0.200, 57,0.200, 19,1.000]]], // Tapsilog Bfast
            [96, [[9,0.200, 57,0.200, 19,1.000]]], // Longsilog Bfast
            [97, [[10,0.200, 57,0.200, 19,1.000]]], // Tosilog Bfast
            [98, [[12,0.200, 57,0.200, 19,1.000]]], // Daing Bfast
            [99, [[11,0.200, 57,0.200, 19,1.000]]], // Corned Bfast
            [100, [[59,0.200, 21,0.100, 26,0.020, 19,1.000]]], // Pancake
            [101, [[59,0.100, 19,0.100, 21,0.100, 26,0.020]], 0.100], // French Toast
            [102, [[56,0.100, 51,0.050, 55,0.050, 21,0.100]]], // Oatmeal
        ];

        foreach ($recipeData as $i => $recipe) {
            $menuIdx = $recipe[0];
            if (! isset($this->ids['menu_map'][$menuIdx])) {
                continue;
            }
            $menuItemId = $this->ids['menu_map'][$menuIdx];
            $recipeId = $this->uid('recipe', $menuIdx + 1);
            DB::table('recipes')->insert([
                'id' => $recipeId,
                'menu_item_id' => $menuItemId,
                'instructions' => null,
                'yield_quantity' => 1,
                'yield_unit' => 'serving',
                'created_at' => $this->sevenYearsAgo,
                'updated_at' => $this->sevenYearsAgo,
            ]);

            foreach ($recipe[1] as $ingredientGroup) {
                $aggregated = [];
                for ($j = 0; $j < count($ingredientGroup); $j += 2) {
                    $ingIdx = $ingredientGroup[$j];
                    $qty = $ingredientGroup[$j + 1];
                    $aggregated[$ingIdx] = ($aggregated[$ingIdx] ?? 0) + $qty;
                }
                foreach ($aggregated as $ingIdx => $qty) {
                    if (! isset($this->ids['ingredient_map'][$ingIdx])) {
                        continue;
                    }
                    $ingId = $this->ids['ingredient_map'][$ingIdx];
                    $unit = DB::table('ingredients')->where('id', $ingId)->value('unit') ?? 'kg';
                    $costPerUnit = DB::table('ingredients')->where('id', $ingId)->value('cost_per_unit') ?? 0;
                    DB::table('recipe_ingredients')->insert([
                        'recipe_id' => $recipeId,
                        'ingredient_id' => $ingId,
                        'quantity' => $qty,
                        'unit' => $unit,
                        'cost' => $costPerUnit * $qty,
                    ]);
                }
            }
        }
    }

    // ==================== TABLES ====================

    private function createTables(): void
    {
        // Create 50 tables with varying capacities
        $tableConfigs = [
            // 10 tables for 2 people (intimate)
            ['count' => 10, 'capacity' => 2, 'shape' => 'rectangle', 'width' => 60, 'height' => 60],
            // 15 tables for 4 people (standard)
            ['count' => 15, 'capacity' => 4, 'shape' => 'rectangle', 'width' => 80, 'height' => 80],
            // 10 tables for 6 people (medium groups)
            ['count' => 10, 'capacity' => 6, 'shape' => 'rectangle', 'width' => 100, 'height' => 100],
            // 8 tables for 8 people (large groups)
            ['count' => 8, 'capacity' => 8, 'shape' => 'round', 'width' => 120, 'height' => 120],
            // 5 tables for 10 people (events)
            ['count' => 5, 'capacity' => 10, 'shape' => 'round', 'width' => 140, 'height' => 140],
            // 2 tables for 12 people (large events)
            ['count' => 2, 'capacity' => 12, 'shape' => 'round', 'width' => 160, 'height' => 160],
        ];

        $statuses = ['available', 'available', 'available', 'available', 'occupied', 'reserved', 'needs_cleaning'];
        $tableNum = 0;

        foreach ($tableConfigs as $config) {
            for ($j = 0; $j < $config['count']; $j++) {
                $tableNum++;
                $id = $this->uid('table', $tableNum);
                $this->ids['tables'][] = $id;
                DB::table('tables')->insert([
                    'id' => $id,
                    'number' => (string)$tableNum,
                    'capacity' => $config['capacity'],
                    'status' => $this->randomFrom($statuses),
                    'shape' => $config['shape'],
                    'pos_x' => $this->randomFloat(10, 600, 1),
                    'pos_y' => $this->randomFloat(10, 500, 1),
                    'width' => $config['width'],
                    'height' => $config['height'],
                    'is_wheelchair_accessible' => $config['capacity'] >= 6 ? (bool)mt_rand(0, 1) : false,
                    'is_active' => true,
                    'created_at' => $this->sevenYearsAgo,
                    'updated_at' => $this->sevenYearsAgo,
                ]);
            }
        }
    }

    // ==================== DISCOUNTS ====================

    private function createDiscounts(): void
    {
        $discounts = [
            ['Senior Citizen Discount', 'SENIOR', 'percentage', 20.00, 'all', null, 200.00, 100, 'Senior Citizens as per RA 9994'],
            ['PWD Discount', 'PWD', 'percentage', 20.00, 'all', null, 200.00, 100, 'Persons with Disability as per RA 10754'],
            ['Employee Meal Discount', 'EMP2024', 'percentage', 50.00, 'all', null, 100.00, 500, 'Staff meal privilege'],
            ['Early Bird Promo', 'EARLYBIRD', 'percentage', 15.00, 'all', 200.00, null, 200, '15% off for orders before 10 AM'],
            ['Birthday Promo', 'BDAY', 'fixed', 100.00, 'all', 500.00, null, 300, 'Birthday celebrant discount'],
            ['Group Promo (5+)', 'GROUP5', 'percentage', 10.00, 'all', 1000.00, 300.00, 100, 'Group dining discount for 5 or more'],
            ['Loyalty Reward', 'LOYAL', 'fixed', 50.00, 'all', 200.00, null, 500, 'Loyalty member discount'],
            ['Holiday Special', 'HOLIDAY', 'percentage', 12.00, 'all', 300.00, null, 100, 'Holiday season promo'],
            ['Student Discount', 'STUDENT', 'percentage', 10.00, 'all', null, 50.00, 300, 'Valid student ID required'],
            ['Referral Credit', 'REFER', 'fixed', 100.00, 'all', 300.00, null, 200, 'Refer a friend discount'],
        ];

        foreach ($discounts as $i => $disc) {
            $id = $this->uid('discount', $i + 1);
            $this->ids['discounts'][] = $id;
            DB::table('discounts')->insert([
                'id' => $id,
                'name' => $disc[0],
                'code' => $disc[1],
                'type' => $disc[2],
                'value' => $disc[3],
                'applies_to' => $disc[4],
                'min_order_amount' => $disc[5],
                'max_discount_amount' => $disc[6],
                'max_uses' => $disc[7],
                'used_count' => $this->randomInt(5, 80),
                'start_date' => $this->sevenYearsAgo,
                'end_date' => (new Carbon($this->sevenYearsAgo))->addYear(),
                'is_active' => true,
                'description' => $disc[8],
                'created_at' => $this->sevenYearsAgo,
                'updated_at' => $this->sevenYearsAgo,
            ]);
        }
    }

    // ==================== RESERVATIONS ====================

    private function createReservations(): void
    {
        $statuses = ['confirmed', 'confirmed', 'confirmed', 'completed', 'completed', 'cancelled', 'no_show', 'pending'];
        $sources = ['phone', 'phone', 'phone', 'walk_in', 'online', 'app'];
        $eventTypes = ['Birthday', 'Anniversary', 'Corporate', 'Wedding', 'Holiday Party', 'Graduation', 'Baby Shower', 'Bridal Shower', 'Rehearsal Dinner', 'Other'];
        $guestFirstNames = ['Juan', 'Maria', 'Jose', 'Ana', 'Pedro', 'Rosa', 'Antonio', 'Luz', 'Carlo', 'Megan',
            'Danny', 'Eliza', 'Ferdie', 'Grace', 'Henry', 'Iris', 'Joel', 'Karen', 'Levi', 'Nena',
            'Carlos', 'Sofia', 'Miguel', 'Isabel', 'Rafael', 'Carmen', 'Andres', 'Lucia', 'Diego', 'Elena'];

        // ~10,000 reservations over 7 years (~4 per day average)
        for ($i = 1; $i <= 10000; $i++) {
            $id = $this->uid('reservation', $i);
            $customerId = $this->randomFrom($this->ids['customers']);
            $tableId = $this->randomFrom($this->ids['tables']);
            $partySize = $this->randomFrom([1, 2, 2, 2, 3, 4, 4, 4, 5, 6, 8, 10]);
            $status = $this->randomFrom($statuses);
            $hasEvent = $partySize >= 6 && mt_rand(0, 4) === 0; // 20% chance for large parties
            $eventType = $hasEvent ? $this->randomFrom($eventTypes) : null;
            
            $resDate = $this->randomDate(
                (new Carbon($this->sevenYearsAgo))->addDays(7),
                (new Carbon($this->now))->addDays(30)
            );
            $hour = $this->randomFrom([11, 11, 12, 13, 17, 17, 18, 18, 19, 19, 20, 17]);
            $minute = $this->randomFrom([0, 0, 15, 30, 30, 45]);
            $resDatetime = "{$resDate} {$hour}:{$minute}:00";

            $table = DB::table('tables')->where('id', $tableId)->first();
            $tableCap = $table ? $table->capacity : 4;

            $duration = $partySize <= 4 ? 180 : 240;
            $endTime = (new Carbon("{$resDate} {$hour}:{$minute}"))->addMinutes($duration)->format('H:i');
            
            $requiresCard = $partySize >= 6 || in_array((new Carbon($resDate))->dayOfWeek, [5, 6]);
            $requiresDeposit = $partySize >= 6;
            $depositAmount = $requiresDeposit ? round($partySize * 30 * 0.5, 2) : 0;

            DB::table('reservations')->insert([
                'id' => $id,
                'customer_id' => $customerId,
                'table_id' => ($tableCap >= $partySize) ? $tableId : null,
                'reservation_number' => 'RES-' . str_pad((string)$i, 5, '0', STR_PAD_LEFT),
                'guest_name' => $this->randomFrom($guestFirstNames) . ' ' . $this->randomFrom([
                    'Santos', 'Cruz', 'Reyes', 'Garcia', 'Mendoza', 'Torres', 'Lopez', 'Gonzalez']),
                'guest_phone' => '0917' . sprintf('%07d', mt_rand(0, 9999999)),
                'guest_email' => 'guest' . $i . '@email.com',
                'party_size' => $partySize,
                'reserved_party_size' => $partySize,
                'reservation_date' => $resDate,
                'reservation_time' => sprintf('%02d:%02d:00', $hour, $minute),
                'end_time' => $endTime,
                'duration_minutes' => $duration,
                'status' => $status,
                'source' => $this->randomFrom($sources),
                'special_requests' => $this->randomFrom([null, null, null, 'Allergic to shrimp', 'Prefer near window',
                    'Anniversary celebration', 'High chair needed', 'Birthday celebration', 'Corporate event']),
                'event_type' => $eventType,
                'card_required' => $requiresCard,
                'deposit_required' => $requiresDeposit,
                'deposit_amount' => $depositAmount,
                'deposit_paid' => $requiresDeposit && mt_rand(0, 1) === 1,
                'card_on_file' => $requiresCard && mt_rand(0, 1) === 1,
                'cancellation_reason' => $status === 'cancelled' ? $this->randomFrom([
                    'Change of plans', 'Weather', 'Emergency', 'Duplicate booking']) : null,
                'created_at' => $createdAt = $this->randomTimestamp($this->sevenYearsAgo, new Carbon($resDatetime)),
                'updated_at' => $createdAt,
            ]);
        }
    }

    // ==================== ORDERS ====================

    private function createOrders(): void
    {
        $orderTypes = ['dine_in', 'dine_in', 'dine_in', 'dine_in', 'takeaway', 'delivery'];
        $itemStatuses = ['pending', 'preparing', 'preparing', 'ready', 'served', 'served', 'cancelled'];
        $hours = [7,8,8,9,10,11,11,12,12,13,13,14,15,17,17,18,18,19,19,20,20,21,21,22,22,23];

        // ~30,000 orders over 7 years (~12 per day average)
        for ($i = 1; $i <= 30000; $i++) {
            $orderId = $this->uid('order', $i);
            $customerId = $this->randomFrom($this->ids['customers']);
            $tableId = $this->randomFrom($this->ids['tables']);
            $orderType = $this->randomFrom($orderTypes);
            $hour = $this->randomFrom($hours);
            $minute = $this->randomFrom([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);

            $numItems = $this->randomFrom([1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 5, 6]);
            $orderDate = $this->randomTimestamp(
                $this->sevenYearsAgo,
                (new Carbon($this->now))->subDays(1)
            );
            $orderDatetime = (new Carbon($orderDate))->setTime($hour, $minute, 0)->format('Y-m-d H:i:s');

            $statusWeights = [];
            $orderTs = new Carbon($orderDatetime);
            $daysAgo = $orderTs->diffInDays($this->now);

            if ($daysAgo < 1) {
                $statusWeights = ['pending', 'preparing', 'ready', 'completed'];
            } elseif ($daysAgo < 3) {
                $statusWeights = ['completed', 'completed', 'completed', 'cancelled'];
            } else {
                $statusWeights = ['completed', 'completed', 'completed', 'completed', 'cancelled'];
            }
            $orderStatus = $this->randomFrom($statusWeights);

            $orderData[] = [
                'id' => $orderId,
                'customer_id' => $customerId,
                'table_id' => $orderType === 'dine_in' ? $tableId : null,
                'order_type' => $orderType,
                'order_number' => 'ORD-' . str_pad((string)$i, 5, '0', STR_PAD_LEFT),
                'order_status' => $orderStatus,
                'order_datetime' => $orderDatetime,
                'num_items' => $numItems,
            ];

            $this->ids['orders'][] = $orderId;

            $subtotal = 0;
            $taxAmount = 0;
            $discountAmount = 0;
            $selectedItems = [];

            for ($j = 0; $j < $numItems; $j++) {
                $menuItemId = $this->randomFrom($this->ids['menu_items']);
                $menuItem = DB::table('menu_items')->where('id', $menuItemId)->first();
                $qty = $this->randomFrom([1, 1, 1, 1, 2, 2, 3]);
                $unitPrice = $menuItem ? $menuItem->price : $this->randomFloat(50, 300);
                $itemSubtotal = $unitPrice * $qty;
                $subtotal += $itemSubtotal;

                $itemStatus = ($orderStatus === 'completed') ? 'served' :
                    ($orderStatus === 'cancelled' ? 'cancelled' : $itemStatuses[array_rand($itemStatuses)]);

                $selectedItems[] = [
                    'id' => $this->uid('orderitem', $i * 10 + $j),
                    'order_id' => $orderId,
                    'menu_item_id' => $menuItemId,
                    'name' => $menuItem ? $menuItem->name : 'Menu Item ' . ($j + 1),
                    'quantity' => $qty,
                    'unit_price' => $unitPrice,
                    'total_price' => $itemSubtotal,
                    'discount_amount' => 0,
                    'status' => $itemStatus,
                    'created_at' => $orderDatetime,
                    'updated_at' => $orderDatetime,
                ];
            }

            // Apply discount occasionally
            $hasDiscount = $this->randomInt(1, 10) <= 2;
            if ($hasDiscount) {
                $discountAmount = $subtotal * $this->randomFloat(0.10, 0.20);
                $discountAmount = round($discountAmount, 2);
            }

            $serviceCharge = $orderType === 'dine_in' ? round($subtotal * 0.05, 2) : 0;
            $taxAmount = round(($subtotal - $discountAmount + $serviceCharge) * 0.12, 2);
            $total = round($subtotal - $discountAmount + $serviceCharge + $taxAmount, 2);

            $paymentStatus = ($orderStatus === 'completed') ? 'paid' :
                ($orderStatus === 'cancelled' ? 'refunded' : 'unpaid');

            DB::table('orders')->insert([
                'id' => $orderId,
                'order_number' => $orderData[$i - 1]['order_number'],
                'customer_id' => $customerId,
                'table_id' => $orderData[$i - 1]['table_id'],
                'order_type' => $orderType,
                'status' => $orderStatus,
                'subtotal' => $subtotal,
                'tax_amount' => $taxAmount,
                'discount_amount' => $discountAmount,
                'service_charge' => $serviceCharge,
                'total' => $total,
                'payment_status' => $paymentStatus,
                'payment_method' => $paymentStatus === 'paid' ? $this->randomFrom(['cash', 'GCash', 'Maya', 'credit_card', 'debit_card']) : null,
                'notes' => $this->randomFrom([null, null, null, 'Extra spicy please', 'No MSG', 'Birthday celebration']),
                'created_by' => $this->randomFrom(array_slice($this->ids['users'], 1)),
                'created_at' => $orderDatetime,
                'updated_at' => $orderDatetime,
            ]);

            foreach ($selectedItems as $item) {
                $this->ids['order_items'][] = $item['id'];
                DB::table('order_items')->insert($item);
            }

            // Create invoice for completed orders
            if ($orderStatus === 'completed') {
                $invoiceId = $this->uid('invoice', $i);
                DB::table('invoices')->insert([
                    'id' => $invoiceId,
                    'invoice_number' => 'INV-' . str_pad((string)$i, 5, '0', STR_PAD_LEFT),
                    'order_id' => $orderId,
                    'subtotal' => $subtotal,
                    'tax_amount' => $taxAmount,
                    'discount_amount' => $discountAmount,
                    'service_charge' => $serviceCharge,
                    'total' => $total,
                    'amount_paid' => $total,
                    'balance' => 0,
                    'status' => 'paid',
                    'created_at' => $orderDatetime,
                    'updated_at' => $orderDatetime,
                ]);

                $paymentId = $this->uid('payment', $i);
                $paymentMethods = ['cash', 'GCash', 'Maya', 'credit_card', 'debit_card'];
                DB::table('payments')->insert([
                    'id' => $paymentId,
                    'invoice_id' => $invoiceId,
                    'amount' => $total,
                    'payment_method' => $this->randomFrom($paymentMethods),
                    'reference_number' => match($pm = $this->randomFrom($paymentMethods)) {
                        'GCash' => 'GC-' . strtoupper(Str::random(10)),
                        'Maya' => 'MY-' . strtoupper(Str::random(10)),
                        'credit_card', 'debit_card' => 'CC-' . strtoupper(Str::random(8)),
                        default => null,
                    },
                    'processed_by' => $this->randomFrom(array_slice($this->ids['users'], 1)),
                    'created_at' => $orderDatetime,
                    'updated_at' => $orderDatetime,
                ]);
            }

            // Order status history
            $statusFlow = [];
            if ($orderStatus === 'completed') {
                $statusFlow = ['pending', 'confirmed', 'preparing', 'ready', 'served', 'completed'];
            } elseif ($orderStatus === 'cancelled') {
                $statusFlow = ['pending', 'cancelled'];
            } else {
                $statusFlow = ['pending', 'confirmed'];
                if (in_array($orderStatus, ['preparing', 'ready', 'served'])) {
                    $statusFlow[] = 'preparing';
                }
                if (in_array($orderStatus, ['ready', 'served'])) {
                    $statusFlow[] = 'ready';
                }
                if ($orderStatus === 'served') {
                    $statusFlow[] = 'served';
                }
            }

            foreach ($statusFlow as $si => $status) {
                DB::table('order_status_history')->insert([
                    'id' => $this->uid('osh', $i * 10 + $si),
                    'order_id' => $orderId,
                    'status' => $status,
                    'notes' => null,
                    'changed_by' => $this->randomFrom(array_slice($this->ids['users'], 1)),
                    'created_at' => (new Carbon($orderDatetime))->addMinutes($si * $this->randomInt(2, 15))->format('Y-m-d H:i:s'),
                    'updated_at' => (new Carbon($orderDatetime))->addMinutes($si * $this->randomInt(2, 15))->format('Y-m-d H:i:s'),
                ]);
            }
        }
    }

    // ==================== KITCHEN TICKETS ====================

    private function createKitchenTickets(): void
    {
        // Local cleanup: no orders means no kitchen tickets.
        return;
        $completedOrders = DB::table('orders')
            ->whereIn('status', ['completed', 'served', 'ready'])
            ->orderBy('created_at')
            ->get();

        $ticketCount = 0;
        $itemCount = 0;
        foreach ($completedOrders as $order) {
            $orderItems = DB::table('order_items')
                ->where('order_id', $order->id)
                ->whereIn('status', ['served', 'ready'])
                ->get();

            if ($orderItems->isEmpty()) continue;

            $ticketCount++;
            if ($ticketCount > 1000) break;

            $ticketId = $this->uid('kot', $ticketCount);
            $priority = $order->order_type === 'delivery' ? 'high' : 'normal';
            $startedAt = (new Carbon($order->created_at))->addMinutes($this->randomInt(2, 8));
            $completedAt = (new Carbon($startedAt))->addMinutes($this->randomInt(10, 30));

            DB::table('kot_tickets')->insert([
                'id' => $ticketId,
                'kot_number' => 'KOT-' . str_pad((string)$ticketCount, 5, '0', STR_PAD_LEFT),
                'order_id' => $order->id,
                'status' => $order->status === 'completed' ? 'served' : $order->status,
                'priority' => $priority,
                'station' => $this->randomFrom(['Main Kitchen', 'Grill Station', 'Beverage Station', 'Dessert Station']),
                'estimated_minutes' => $this->randomInt(10, 30),
                'started_at' => $startedAt,
                'completed_at' => $completedAt,
                'created_at' => $order->created_at,
                'updated_at' => $completedAt,
            ]);

            foreach ($orderItems as $oi) {
                $itemCount++;
                $ktItemId = $this->uid('kotitem', $itemCount);
                DB::table('kot_ticket_items')->insert([
                    'id' => $ktItemId,
                    'kot_ticket_id' => $ticketId,
                    'order_item_id' => $oi->id,
                    'name' => $oi->name,
                    'quantity' => $oi->quantity,
                    'notes' => $oi->notes,
                    'status' => $order->status === 'completed' ? 'completed' : 'pending',
                    'created_at' => $order->created_at,
                    'updated_at' => $order->created_at,
                ]);
            }
        }
    }

    // ==================== STAFF SHIFTS ====================

    private function createStaffShifts(): void
    {
        $shifts = [
            ['Morning Shift', '06:00:00', '14:00:00'],
            ['Afternoon Shift', '14:00:00', '22:00:00'],
            ['Night Shift', '22:00:00', '06:00:00'],
        ];

        foreach ($shifts as $i => $shift) {
            $id = $this->uid('staffshift', $i + 1);
            $this->ids['staff_shifts'][] = $id;
            DB::table('staff_shifts')->insert([
                'id' => $id,
                'name' => $shift[0],
                'start_time' => $shift[1],
                'end_time' => $shift[2],
                'created_at' => $this->sevenYearsAgo,
                'updated_at' => $this->sevenYearsAgo,
            ]);
        }
    }

    // ==================== SHIFT SCHEDULES ====================

    private function createStaffSchedules(): void
    {
        $schedulesPerMonth = 15;
        for ($i = 0; $i < 90; $i++) {
            $staffId = $this->randomFrom($this->ids['staff_profiles']);
            $shiftId = $this->randomFrom($this->ids['staff_shifts']);
            $scheduleDate = $this->randomDate(
                $this->sevenYearsAgo,
                (new Carbon($this->now))->addMonth()
            );
            $status = $this->randomFrom(['scheduled', 'scheduled', 'scheduled', 'completed', 'absent', 'cancelled']);

            DB::table('shift_schedules')->insert([
                'id' => $this->uid('sched', $i + 1),
                'staff_id' => $staffId,
                'shift_id' => $shiftId,
                'date' => $scheduleDate,
                'status' => $status,
                'notes' => $status === 'absent' ? $this->randomFrom(['Sick', 'Emergency', 'Personal leave']) : null,
                'created_at' => $createdAt = $this->randomTimestamp($this->sevenYearsAgo, new Carbon($scheduleDate)),
                'updated_at' => $createdAt,
            ]);
        }
    }

    // ==================== PURCHASE ORDERS ====================

    private function createPurchaseOrders(): void
    {
        $poStatuses = ['draft', 'pending', 'approved', 'delivered', 'cancelled'];

        // ~1,500 purchase orders over 7 years
        for ($i = 1; $i <= 1500; $i++) {
            $poId = $this->uid('purchaseorder', $i);
            $supplierId = $this->randomFrom($this->ids['suppliers']);
            $status = $this->randomFrom($poStatuses);
            $expectedDate = $status === 'delivered' ? null : $this->randomDate($this->sevenYearsAgo, (new Carbon($this->now))->addMonth());
            $receivedAt = $status === 'delivered' ? $this->randomTimestamp($this->sevenYearsAgo) : null;

            $numItems = $this->randomInt(1, 8);
            $totalAmount = 0;
            $poItems = [];

            for ($j = 0; $j < $numItems; $j++) {
                $ingId = $this->randomFrom($this->ids['ingredients']);
                $ingredient = DB::table('ingredients')->where('id', $ingId)->first();
                if (!$ingredient) continue;

                $qty = $this->randomInt(1, 50);
                $unitCost = $ingredient->cost_per_unit;
                $totalCost = round($qty * $unitCost, 2);
                $totalAmount += $totalCost;

                $poItems[] = [
                    'id' => $this->uid('poitem', $i * 10 + $j),
                    'purchase_order_id' => $poId,
                    'ingredient_id' => $ingId,
                    'quantity' => $qty,
                    'unit' => $ingredient->unit,
                    'unit_cost' => $unitCost,
                    'total_cost' => $totalCost,
                    'received_quantity' => $status === 'delivered' ? $qty : 0,
                ];
            }

            DB::table('purchase_orders')->insert([
                'id' => $poId,
                'po_number' => 'PO-' . str_pad((string)$i, 5, '0', STR_PAD_LEFT),
                'supplier_id' => $supplierId,
                'total_amount' => round($totalAmount, 2),
                'status' => $status,
                'notes' => $this->randomFrom([null, null, 'Urgent delivery needed', 'Please check quality upon delivery']),
                'expected_date' => $expectedDate,
                'received_at' => $receivedAt,
                'created_by' => $this->randomFrom(array_slice($this->ids['users'], 1)),
                'created_at' => $createdAt = $this->randomTimestamp($this->sevenYearsAgo),
                'updated_at' => $createdAt,
            ]);

            foreach ($poItems as $item) {
                DB::table('purchase_order_items')->insert($item);
            }
        }
    }

    // ==================== STOCK MOVEMENTS ====================

    private function createStockMovements(): void
    {
        $types = ['in', 'in', 'in', 'in', 'out', 'out', 'out', 'adjustment', 'wastage'];
        $reasons = [
            'in' => ['Supplier delivery', 'Return from kitchen', 'Transfer from main warehouse'],
            'out' => ['Recipe consumption', 'Kitchen use', 'Transfer to other branch'],
            'adjustment' => ['Inventory count adjustment', 'System correction'],
            'wastage' => ['Spoilage', 'Expired stock', 'Damaged packaging', 'Prep waste'],
        ];

        // ~5,000 stock movements over 7 years
        for ($i = 1; $i <= 5000; $i++) {
            $ingId = $this->randomFrom($this->ids['ingredients']);
            $ingredient = DB::table('ingredients')->where('id', $ingId)->first();
            if (!$ingredient) continue;

            $type = $this->randomFrom($types);
            $qty = $type === 'in'
                ? $this->randomFloat(1, $ingredient->maximum_stock ?? 100)
                : $this->randomFloat(0.1, min(20, $ingredient->current_stock ?: 50));

            DB::table('stock_movements')->insert([
                'id' => $this->uid('stockmove', $i),
                'ingredient_id' => $ingId,
                'type' => $type,
                'quantity' => $type === 'out' || $type === 'wastage' ? -$qty : $qty,
                'unit_cost' => $ingredient->cost_per_unit,
                'reference_type' => $this->randomFrom([null, 'App\Models\PurchaseOrder', 'App\Models\Order', null]),
                'reference_id' => null,
                'notes' => $this->randomFrom($reasons[$type]),
                'created_by' => $this->randomFrom(array_slice($this->ids['users'], 1)),
                'created_at' => $this->randomTimestamp($this->sevenYearsAgo),
                'updated_at' => $this->randomTimestamp($this->sevenYearsAgo),
            ]);

            // Update ingredient stock
            $newStock = max(0, $ingredient->current_stock + ($type === 'out' || $type === 'wastage' ? -$qty : $qty));
            DB::table('ingredients')->where('id', $ingId)->update([
                'current_stock' => round($newStock, 3),
                'updated_at' => $this->now,
            ]);
        }
    }

    // ==================== AUDIT LOGS ====================

    private function createAuditLogs(): void
    {
        $actions = ['created', 'updated', 'deleted', 'viewed', 'logged_in', 'logged_out', 'exported', 'approved', 'cancelled', 'processed'];
        $models = [
            'App\Models\User' => ['User created', 'User updated', 'User deleted', 'Login', 'Logout'],
            'App\Models\Customer' => ['Customer created', 'Customer updated', 'Customer deleted'],
            'App\Models\Order' => ['Order created', 'Order updated', 'Order cancelled', 'Order completed'],
            'App\Models\MenuItem' => ['Menu item created', 'Menu item updated', 'Menu item deleted'],
            'App\Models\Reservation' => ['Reservation created', 'Reservation updated', 'Reservation cancelled'],
            'App\Models\Payment' => ['Payment processed', 'Refund processed'],
            'App\Models\PurchaseOrder' => ['Purchase order created', 'Purchase order approved', 'Purchase order received', 'Purchase order cancelled'],
            'App\Models\Ingredient' => ['Ingredient added', 'Ingredient updated', 'Stock adjustment'],
            'App\Models\Supplier' => ['Supplier created', 'Supplier updated'],
        ];

        // ~15,000 audit logs over 7 years
        for ($i = 1; $i <= 15000; $i++) {
            $modelType = $this->randomFrom(array_keys($models));
            $actionDesc = $this->randomFrom($models[$modelType]);
            $action = $this->randomFrom($actions);

            DB::table('audit_logs')->insert([
                'id' => $this->uid('audit', $i),
                'user_id' => $this->randomFrom($this->ids['users']),
                'auditable_type' => $modelType,
                'auditable_id' => $this->uid('auditable', $i),
                'action' => $action,
                'old_values' => json_encode($action === 'updated' ? ['name' => 'Old Value'] : null),
                'new_values' => json_encode(['name' => $actionDesc]),
                'ip_address' => mt_rand(10, 200) . '.' . mt_rand(0, 255) . '.' . mt_rand(0, 255) . '.' . mt_rand(1, 254),
                'user_agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'created_at' => $createdAt = $this->randomTimestamp($this->sevenYearsAgo),
                'updated_at' => $createdAt,
            ]);
        }
    }
}
