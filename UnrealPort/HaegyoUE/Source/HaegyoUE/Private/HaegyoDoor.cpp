#include "HaegyoDoor.h"
#include "Components/StaticMeshComponent.h"

AHaegyoDoor::AHaegyoDoor()
{
	PrimaryActorTick.bCanEverTick = true;
	USceneComponent* Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	SetRootComponent(Root);
	Panel = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Panel"));
	Panel->SetupAttachment(Root);
}

void AHaegyoDoor::OnConstruction(const FTransform& T)
{
	Super::OnConstruction(T);
	if (!DoorId.IsValid()) DoorId = FGuid::NewGuid();
	Target = Open; Apply();
}

void AHaegyoDoor::Interact_Implementation(AActor*)
{
	if (bLocked) return;
	Target = Target > .5f ? 0.f : 1.f;
}

FText AHaegyoDoor::GetPrompt_Implementation() const
{
	return FText::Format(FText::FromString(TEXT("{0} {1}")), DoorName, FText::FromString(Target > .5f ? TEXT("닫기") : TEXT("열기")));
}

void AHaegyoDoor::Tick(float Dt)
{
	Super::Tick(Dt);
	if (!FMath::IsNearlyEqual(Open, Target)) { Open = FMath::FInterpConstantTo(Open, Target, Dt, 2.2f); Apply(); }
}

void AHaegyoDoor::Apply()
{
	if (bSliding) Panel->SetRelativeLocation(FVector(0.f, SlideDistance * Open, 0.f));
	else Panel->SetRelativeRotation(FRotator(0.f, HingeAngle * Open, 0.f));
}
